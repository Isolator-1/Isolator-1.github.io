---
title: unlink 
tags: [ctf-pwn]
date: 2022-11-25 10:19:00
excerpt: unlink 
---

> 以下内容一律假设 sz = 4 bytes  ，32位系统

#### unlink时向任意地址写入数据原理

假设需要从bin中摘除一个**首地址为P**的chunk

32位系统下，fd相对于块首的偏移为8（prevsize和size都是4字节），bk偏移为12

即 `fd = P+8 ` ，`bk = P+12`

```C
// unlink时需要 将P.fd指向的块的bk 赋值为 P.bk上的值
*(*(P+8)+12) = *(P+12)
// 将P.bk指向的块的fd 赋值为 P.fd上的值
*(*(P+12)+8) = *(P+8)
```

假设想要向0x4000000C这个地址上写入0xdeadbeef这个值

只需将`*(P+8)`赋值为0x40000000，将`*(P+12)`赋值为0xdeadbeef，在unlink时就会完成赋值

这种方法是将fd设置为了target addr - 12 ，bk设置为了expect value

> 也可以将fd设置为expect value，bk设置为target addr - 8，但是后文默认均使用前一种攻击方法

unlink漏洞同时向两个地址进行了写入，所以在保证targe taddr -12 可以写入的同时，也要保证expect value + 8 有写入权限

#### 加入检查机制之后

```C
FD = P->fd;
BK = P->bk;
if (__builtin_expect (FD->bk != P || BK->fd != P, 0))                      
  malloc_printerr (check_action, "corrupted double-linked list", P, AV); 
FD->bk = BK;
BK->fd = FD;
```

因此溢出时需要额外保证以下条件

```
*(*(P+8) +12) == P
*(*(P+12)+ 8) == P
```

所以需要找到堆管理列表里面指向chunk P的指针**ptr**，让P的fd指向ptr-12，P的bk指向ptr-8，这样P->fd->bk指向P，P->bk->fd也指向P。

绕过if判断之后，下面两条赋值语句首先将 FD->bk（也就是ptr）指向了BK，再将BK->fd（还是ptr，又改变了一次ptr）指向了FD。

因此后面这两条赋值语句确实完成了FD和BK unlink 的效果，唯一被改变的是ptr，它从原本指向chunk p，变成了*(ptr - 12)

#### 利用方法

见文章 ：stkof

