---
title: OS
tags: [操作系统]
date: 2023-12-13 18:38:00
categories: [学习笔记]
excerpt: 操作系统补习 (for kernel pwn)
---

## 控制流转移

### 用户态到内核态

1. 切换GS段寄存器

   swapgs指令，把GS段寄存器和某个特定位置的值进行交换，保存GS值，同时交换过来的值作为内核态的GS

2. 保存用户栈帧信息

   把用户态栈顶记录在`CPU独占变量区域里`，再把CPU独占区域里记录内核栈顶放入rsp中

3. 保存用户态寄存器信息

   把寄存器push到栈上形成一个pt_regs结构体

4. 通过汇编指令判断是否为32位，将控制权交给内核

从内核态回到用户态时，依旧用swapgs指令切换GS寄存器，通过syretq或iretq指令让CPU模式回到ring 3，恢复用户态的状态

### 中断

CPU停下工作，执行中断处理程序。

实模式下，使用中断向量表（interrupt vector table）存放每个中断号对应的处理程序。保护模式引入中断描述符表IDT（Interrupt Descriptor Table）存放门描述符（gate descriptor），而这个IDT的地址存放在IDTR寄存器中。

#### 门是什么

gate会在中断前进行检查

1. 中断门（Interrupt Gate）处理硬中断，进入中断门后IF标志位会被清除，防止中断嵌套。并且中断门只能在内核态下访问（Descriptor Priviledge Level = 0）
2. 陷阱门（Trap Gate）处理CPU异常，但不会清空IF
3. 系统门（System Gate）系统调用（Descriptor Priviledge Level = 3）主要用于系统调用

![](/img/学习笔记/OS/1.jpg)



### 系统调用

> 32位的系统调用参数是ebx，ecx，edx，esi，edi，ebp
>
> 64位还是和普通函数一样

32位的时候，通过int 0x80触发一个软中断进入kernel mode，但是到了64位的时候有了syscall和sysenter指令，内核启动时会将系统调用函数入口（entry_SYSCALL_64）写入MSR寄存器组中，sycall时进入ring0并跳到MSR寄存器所指定的系统调用入口

因此syscall性能是比int0x80高的

![](/img/学习笔记/OS/2.jpg)



### 信号

首先，一个进程收到信号，信号会被存储到进程描述符的信号队列中

当进程被重新调度时，内核检查其信号队列，处理信号。内核会将用户态寄存器push到用户态栈上，形成sigcontext结构体，然后push SIGNALINFO以及指向sigreturn的代码。这些内容构成了**SigreturnFrame**（SROP伪造的就是这个结构体）

接下来控制被返回到用户态进程，跳转到对应的signal handler函数，完成之后会执行sigreturn（也是一个系统调用）

又进入了内核态，恢复原有的用户态上下文信息

控制权返还用户态

> 虽然信号不是及时处理的，但由于linux进程调度非常频繁，信号能很快被处理

![](/img/学习笔记/OS/3.jpg)



## 进程权限

在linux kernel源码中，`include/linux/sched.h`中定义了taskt_struct结构体来描述进程，结构体中三个Process credentials描述了进程的权限

1. `ptracer_cred` 使用ptrace系统调用跟踪该进程的上级进程的cred（gdb的原理）如果提前占用这个位置就可以反调试
2. `real_cred` 客体凭证（objective cred）通常是一个进程启动时具有的权限
3. `cred` 主体凭证（subjective cred）该进程的有效cred，kernel以此作为进程权限的凭证

这三个都是一个cred结构体的指针，在cred结构体中

```c
struct cred {
    atomic_t    usage;
#ifdef CONFIG_DEBUG_CREDENTIALS
    atomic_t    subscribers;    /* number of processes subscribed */
    void        *put_addr;
    unsigned    magic;
#define CRED_MAGIC    0x43736564
#define CRED_MAGIC_DEAD    0x44656144
#endif
    kuid_t        uid;        /* real UID of the task */
    kgid_t        gid;        /* real GID of the task */
    kuid_t        suid;        /* saved UID of the task */
    kgid_t        sgid;        /* saved GID of the task */
    kuid_t        euid;        /* effective UID of the task */
    kgid_t        egid;        /* effective GID of the task */
    kuid_t        fsuid;        /* UID for VFS ops */
    kgid_t        fsgid;        /* GID for VFS ops */
    unsigned    securebits;    /* SUID-less security management */
    kernel_cap_t    cap_inheritable; /* caps our children can inherit */
    kernel_cap_t    cap_permitted;    /* caps we're permitted */
    kernel_cap_t    cap_effective;    /* caps we can actually use */
    kernel_cap_t    cap_bset;    /* capability bounding set */
    kernel_cap_t    cap_ambient;    /* Ambient capability set */
#ifdef CONFIG_KEYS
    unsigned char    jit_keyring;    /* default keyring to attach requested
                     * keys to */
    struct key    *session_keyring; /* keyring inherited over fork */
    struct key    *process_keyring; /* keyring private to this process */
    struct key    *thread_keyring; /* keyring private to this thread */
    struct key    *request_key_auth; /* assumed request_key authority */
#endif
#ifdef CONFIG_SECURITY
    void        *security;    /* subjective LSM security */
#endif
    struct user_struct *user;    /* real user ID subscription */
    struct user_namespace *user_ns; /* user_ns the caps and keyrings are relative to. */
    struct group_info *group_info;    /* supplementary groups for euid/fsgid */
    /* RCU deletion */
    union {
        int non_rcu;            /* Can we skip RCU deletion? */
        struct rcu_head    rcu;        /* RCU deletion hook */
    };
} __randomize_layout;
```

copy过来的，但不是很理解（

```
一个cred结构体中记载了一个进程四种不同的用户ID：

真实用户ID（real UID）：标识一个进程启动时的用户ID
保存用户ID（saved UID）：标识一个进程最初的有效用户ID
有效用户ID（effective UID）：标识一个进程正在运行时所属的用户ID，一个进程在运行途中是可以改变自己所属用户的，因而权限机制也是通过有效用户ID进行认证的，内核通过 euid 来进行特权判断；为了防止用户一直使用高权限，当任务完成之后，euid 会与 suid 进行交换，恢复进程的有效权限
文件系统用户ID（UID for VFS ops）：标识一个进程创建文件时进行标识的用户ID
在通常情况下这几个ID应当都是相同的

用户组ID同样分为四个：真实组ID、保存组ID、有效组ID、文件系统组ID
```

### 进程权限改变

kernel/cred.c中

```cred* prepare_kernel_cred(struct task_struct* daemon)```可以拷贝一个进程的cred进程的结构体，返回一个新的结构体

```int commit_creds(struct cred *new)```将一个新的cred结构体应用到进程



## LKMs

Loadable Kernel Modules

lsmod查看所有的LKMs

insmod/remod 装载/溢出LKM