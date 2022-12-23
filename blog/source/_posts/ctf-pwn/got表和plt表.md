---
title: GOT表和PLT表
tags: [ctf-pwn]
date: 2022-11-16 16:08:00
categories: [ctf-pwn]
excerpt: Linux 动态链接与延迟绑定机制
---

Linux 动态链接与延迟绑定机制

**Q：**

1. 为什么ret2libc泄露基址时要选择已经使用过的函数？
2. 何为延迟绑定？

## Linux 动态链接与延迟绑定机制

​    假设，写了一个函数```f()```，调用了glibc中函数```x()```，在可执行文件是如何编译的？

​	对于libc中的函数，例如system、puts、write等，需要在程序运行时动态加载到内存中，不同版本的libc加载的位置各不相同，gcc没有办法直接在函数```f()```的汇编指令中直接call函数```x()```的真实地址

​	因此，需要在调用前加入一个寻找函数地址的过程

```assembly
.text
 ...
 call f_stub
 ...
 
 ...
 f_stub:
 	 1. find and save function f() entry point in f_stub_addr
     2. mov eax, [f_addr]
        jmp eax
 ...
 
.data
 f_addr  // 存储实际的f()地址
```

​	如上述过程，f_stub去寻找实际的地址，存储在f_addr中，然后调用它

​	linux的动态链接过程与上述类似，也是由一个存放外部函数地址数据GOT表（对应f_addr)，和一段函数调用额外的代码PLT表（对应f_stub)

​	后文会具体分析其机制




##### 实验参考

<https://www.yuque.com/hxfqg9/bin/ug9gx5#5dvaL>

<https://www.bilibili.com/video/BV1a7411p7zK/?spm_id_from=333.337.search-card.all.click>

##### 代码

```C
#include <stdio.h>
void print_banner()
{
    printf("Welcome to World of PLT and GOT\n");
}
int main(void)
{
    print_banner();
    return 0;
}
```

##### 编译链接

```gcc -Wall  -g test.c -o test.o -m32```

**平台**： **kali**-**linux**

开始调试

**首先，在printf函数调用前下一个断点**

![](/img/plt&got/1.png)

```assembly
[-------------------------------------code-------------------------------------]
   0x555555555134 <frame_dummy+4>:      jmp    0x5555555550b0 <register_tm_clones>
   0x555555555139 <print_banner>:       push   rbp
   0x55555555513a <print_banner+1>:     mov    rbp,rsp
=> 0x55555555513d <print_banner+4>:     lea    rax,[rip+0xec4]        # 0x555555556008
   0x555555555144 <print_banner+11>:    mov    rdi,rax
   0x555555555147 <print_banner+14>:    call   0x555555555030 <puts@plt>
   0x55555555514c <print_banner+19>:    nop
   0x55555555514d <print_banner+20>:    pop    rbp
```

跳转到了0x555555555030这个地址，gdb对其的标注为\<puts@plt\>

查看一下这个地址上的内容

```assembly
gdb-peda$ x/10i 0x555555555030
   0x555555555030 <puts@plt>:   jmp    QWORD PTR [rip+0x2fca]        # 0x555555558000 <puts@got[plt]>
   0x555555555036 <puts@plt+6>: push   0x0
   0x55555555503b <puts@plt+11>:        jmp    0x555555555020
```

这里第一条指令，jmp 0x555555558000，gdb对其的标注为\<puts@got[plt]\>，查看这个地址上的值，会发现这个指令在原地跳转：

```assembly
gdb-peda$ x/x 0x555555558000 
0x555555558000 <puts@got[plt]>: 0x0000555555555036 //这个地址就是上面plt表的第二条指令
```

相当于什么也没做

那么根据文章开头的介绍，寻找函数的工作肯定是由第三条指令，```jmp 0x555555555020```来完成的，这里先不对这个函数进行分析，直接来看结果

**在printf函数后面下断点，重新查看刚才\<puts@got[plt]\>上的内容**

![](/img/plt&got/2.jpg)

```assembly
gdb-peda$ x/x 0x555555558000
0x555555558000 <puts@got[plt]>: 0x00007ffff7c75db0
```

发现这个地方的值变了，而这个改变后的值就是puts函数在libc中的地址

```assembly
gdb-peda$ x/10i 0x00007ffff7c75db0
   0x7ffff7c75db0 <__GI__IO_puts>:      push   r14
   0x7ffff7c75db2 <__GI__IO_puts+2>:    push   r13
   0x7ffff7c75db4 <__GI__IO_puts+4>:    push   r12
   0x7ffff7c75db6 <__GI__IO_puts+6>:    mov    r12,rdi
   0x7ffff7c75db9 <__GI__IO_puts+9>:    push   rbp
   0x7ffff7c75dba <__GI__IO_puts+10>:   push   rbx
   0x7ffff7c75dbb <__GI__IO_puts+11>:   sub    rsp,0x10
   0x7ffff7c75dbf <__GI__IO_puts+15>:   call   0x7ffff7c28110 <*ABS*+0x99da0@plt>
   0x7ffff7c75dc4 <__GI__IO_puts+20>:   mov    r13,QWORD PTR [rip+0x17e04d]        # 0x7ffff7df3e18
   0x7ffff7c75dcb <__GI__IO_puts+27>:   mov    rbx,rax
```

**因此可以得出结论**

​	plt表中会先尝试跳转到got表上的函数地址，如果是第一次调用，会进行一次无效跳转，然后去寻找真正的地址填充在got表项上，然后调用；如果是第二次调用，会直接jmp到got表真实的函数地址上

​	这样就是为什么ret2libc需要使用用已被调用过的函数

*tips：*

*linux程序都有一个libc_start_main函数，且会在main函数之前被调用，所以可以在ret2libc时无脑用这个函数(只是个人猜测，并未实际验证)*



**然后解决如何寻找函数地址的问题**：

​	在plt表的第二条汇编指令中，push 0x0为寻址函数提供了一个参数，如果打开一个具有多个plt表项的程序，会发现每一项这个值都是不同的：

![](/img/plt&got/3.jpg)

​	这个push的值唯一标识了寻找的函数，

​	然后再看第三条指令，观察发现这个jmp指令跳转到了plt表的开头（可以在objdump里看到这也是一个plt表项，但是代码与其他表项形式不同）

```assembly
gdb-peda$ x/10i 0x555555555020
   0x555555555020:      push   QWORD PTR [rip+0x2fca]        # 0x555555557ff0
   0x555555555026:      jmp    QWORD PTR [rip+0x2fcc]        # 0x555555557ff8
```

如果在gdb未开始调试的时候，查看这个jmp的值，是0x0

而在printf函数前的断点查看，会发现它发生了变化

```assembly
gdb-peda$ x/x 0x555555557ff8
0x555555557ff8: 0x00007ffff7fdc080

gdb-peda$ x/10i 0x00007ffff7fdc080
   0x7ffff7fdc080 <_dl_runtime_resolve_xsavec>: push   rbx
   0x7ffff7fdc081 <_dl_runtime_resolve_xsavec+1>:       mov    rbx,rsp
   0x7ffff7fdc084 <_dl_runtime_resolve_xsavec+4>:       and    rsp,0xffffffffffffffc0
   0x7ffff7fdc088 <_dl_runtime_resolve_xsavec+8>:
    sub    rsp,QWORD PTR [rip+0x20be1]        # 0x7ffff7ffcc70 <_rtld_global_ro+432>
   0x7ffff7fdc08f <_dl_runtime_resolve_xsavec+15>:      mov    QWORD PTR [rsp],rax
   0x7ffff7fdc093 <_dl_runtime_resolve_xsavec+19>:      mov    QWORD PTR [rsp+0x8],rcx
   0x7ffff7fdc098 <_dl_runtime_resolve_xsavec+24>:      mov    QWORD PTR [rsp+0x10],rdx
   0x7ffff7fdc09d <_dl_runtime_resolve_xsavec+29>:      mov    QWORD PTR [rsp+0x18],rsi
   0x7ffff7fdc0a2 <_dl_runtime_resolve_xsavec+34>:      mov    QWORD PTR [rsp+0x20],rdi
   0x7ffff7fdc0a7 <_dl_runtime_resolve_xsavec+39>:      mov    QWORD PTR [rsp+0x28],r8

```

这个函数为```_dl_runtime_resolve(link_map_obj, reloc_index)```，此处不在对其具体分析，其用处即为寻找编号为```reloc_index```的函数



##### 整体流程

**第一次调用**

![](/img/plt&got/4.jpg)

**第二次调用**

![](/img/plt&got/5.jpg)

