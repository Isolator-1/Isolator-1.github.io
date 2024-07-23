---
title: Heap 基础知识
tags: [ctf-pwn,heap]
date: 2022-11-18 12:19:00
categories: [ctf-pwn]
excerpt: basic knowledge in heap exploitation
---

### malloc

```c++
#include <stdlib.h>
void *malloc(size_t size);
```

size = 0时，返回系统允许的最小内存块

32位系统下malloc(0)分配8Bytes，64位分配16Bytes

### calloc

会清空chunk，并且不从tcache种拿chunk，但是free时还是会放到tcache bin

### brk

堆段的起点和终点标识符：start_brk、brk（program brk)

不开ASLR，初始时都指向bss段末尾（end_data)

开启ASLR，会随机向后偏移一段距离

`brk()`函数作用为抬高brk指针，获取一段heap

程序开始时heap大小为0，第一次申请堆的时候，通过brk()向系统申请一段内存  **main_arena**，后面malloc都会从main_arena中申请内存





### chunk

```C
struct malloc chunk{
    INTERNAL_SIZE_T mchunk_prev_size; /* Size of previous chunk (if free).*/
    INTERNAL_SIZE_T mchunk_size;      /* Size in bytes，including overhead.*/
    struct malloc chunk* fd;          /* double links -- used only if free.*/
    struct malloc chunk* bk;          /* Only used for large blocks: pointer to next larger size. */
    struct malloc_chunk* fd_nextsize; /* double links -- used only if free.*/
    struct malloc chunk* bk_nextsize;
}
typedef struct malloc_chunk* mchunkptr;
```



#### allocated chunk

**`prevsize `：**如果前一个chunk是free的***（这里指的是内存中的前一个，而不是freelist中的前一个）***，它代表前一个chunk的大小；如果不是free的，存储前一个的user data 。32位中是4字节，64位中是8字节

**`size`：**此chunk大小。最低3位用来存储N（chunk 在 non_main_arena里为1）、M（chunk是mmap得到的为1）、P（前一个chunk已被分配为1 对应prevsize），因此size是8字节对齐的

没有 **fd bk fd_nextsieze bk_nextsize**

**`userdata`：**数据

（下一个chunk的prevsize也会存储userdata）

```C
#define request2size(req) ...   //可以计算申请字节需要实际分配多少字节
```

chunk是在prevsize开始，但是malloc返回的指针指向userdata



#### free chunk 

`prevsize`：上一个chunk的userdata，因为上一个如果也是free，则会被合并（fast bin中可能会例外，后面会提及）

`size`：同上

`fd bk`：（在freelist中的）前一个/后一个chunk



#### top chunk

位于arena顶部。在所有bin都没有满足需求的chunk时，从top chunk切割

top chunk 不够，在main_arena中会用brk扩张top chunk，non_main_arena中，用mmap分配新的堆



### Bin

除了fastbin被存储在一个长度为10的fastbinY的数组里，其余的small large unsorted bin都存储在一个bins数组里

NBINS是126，包括1个unsorted bin，62个small bin，63个large bin。

<div class="mxgraph" style="max-width:100%;border:1px solid transparent;" data-mxgraph="{&quot;highlight&quot;:&quot;#0000ff&quot;,&quot;nav&quot;:true,&quot;resize&quot;:true,&quot;toolbar&quot;:&quot;zoom layers tags lightbox&quot;,&quot;edit&quot;:&quot;_blank&quot;,&quot;xml&quot;:&quot;&lt;mxfile host=\&quot;app.diagrams.net\&quot; modified=\&quot;2022-11-17T04:09:19.532Z\&quot; agent=\&quot;5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36\&quot; etag=\&quot;ojfzveORWWdzC3RN6ooc\&quot; version=\&quot;20.5.3\&quot; type=\&quot;device\&quot;&gt;&lt;diagram id=\&quot;FyZdLwTWtfESSsWo7Yml\&quot; name=\&quot;第 1 页\&quot;&gt;7ZlNc5swEIZ/jY/JgASCHOPEaQ7pNDNups0poxoF6GCJCvmrv74rIwyCEieeSUybnMyupEV6tK9YwwhfzNefJM2TzyJi2Qg50XqEL0cIuTg8gx/t2RiPEzilJ5ZpVPoajmn6m1UdjXeRRqwwvtKlhMhUmtvOmeCczZTlo1KKld3tUWSR5chpzKxpaMd0RjPW6fYtjVRSekMU1P5rlsZJdWeXmBXPadXZBC4SGolVw4UnI3whhVDl1Xx9wTJNz+Zy1dO6m5hkXD1nwPVEnE/c5bn/8JD9ouvwhn+5OzFRljRbmAV/FYrqYeOUFyNEMog9/iHhKtZXLiZmNWpTIZJiwSOm7+JAj1WSKjbN6Uy3riArwJeoeQaWC5ePgiuzyy4B29yfScXWvQtzd7gg0ZiYMyU30MUMQBVyk2MnQVjaq3rDXGJ2IWlsVmh81ORIvAtdY4QLQ/IFVHGH6hUtVD9UZ3BMXddCivzgyEi9DtI7XghYYdSPdXBUEQkGhtXvYL2hEk7EPqYEDw6qj52BQSUdqNM5zfoPVYIGBzVonanHhxp0oPaoHg3vCdVO0QAdGeZZB2aHGYugDjImFxx+xnDcJiIWnGY3QuQG10+m1MbwogslbJg2+SZawDVmPDrXNRrYImccPIWictfFK7s0zUIs5IzdMpkCCCb1LqY8htYQGpU+ulRP42whl9uJ6Gmxdaq+60mdIt+Y942my7WZ8NbYVAYH9OUovzLvm231sK1VjSvRap5Ppw/g365uf7lWLnRfAdJNx2a+eSa3JMuoSpf23P6WcCbcrUi5qlMbO61KISR2CLNj5ahmedoK5Hl7ApndbQeCBKKbRrdcdyg6CtlROFw0VZn2flVzoAAqtbkNqUGIwH9abmDsZnU8KQUfUnoFKXX/d74zKf2jD6Dgmarx3kw17drKdfCBqsF2yYvdVqDjqwZ9qEY18v9/E43/ZqJBDrJyvXov8VLNuO33REEr0PE1030X9141ExwkGo80VXPinML5uqfc09YrVm7PlRN5MzkR1HoGVW90Xqongj1bT21hvqKewKw/RpTd6286ePIH&lt;/diagram&gt;&lt;/mxfile&gt;&quot;}"></div>
<script type="text/javascript" src="https://viewer.diagrams.net/js/viewer-static.min.js"></script>
#### fast bin

在free一个chunk到fast bin时，它下一个chunk的P位（PREV_INUSE)是不会变的，还是为1，为了加快free的效率。**因此地址连续的两个chunk 被free到fast bin，他们不会被合并**。

**content的大小范围：32位：8\~80，64位：16\~160**，都是10个bin，但是实际上fastbin的大小范围并不包含最大的两个bin (64bit 0x80就已经不进fastbin了)

新的chunk加入bin时，**fd**指向原来的栈顶，先进后出（LIFO）

#### small bin

大小范围

32位，最小为16字节，公差为8，最大为504字节，所以是62个small bin

64为，最小为32字节，公差为16，最大为1008字节

#### large bin

大小范围

32位（大于等于512字节）64位（大于等于1024字节），每个链表里的chunk不一定一样大，只要是属于某个特定区间就行

63个bin被分为6组

|      | 数量 |  公差  |
| :--: | :--: | :----: |
|  1   |  32  | 64字节 |
|  2   |  16  |  512   |
|  3   |  8   |  4096  |
|  4   |  4   | 32768  |
|  5   |  2   | 262144 |
|  6   |  1   | 不限制 |

第一组起始大小是512，也就是第一组的第一个bin的范围为[512,512+64) ， 最后一个为[512 + 64\*31, 512 + 64\*32)

第二组接着第一组的末尾，第一个bin也就是[2560, 2560+ 512)，以此类推

每个的具体大小可在第四个参考文献里看

#### unsorted bin

释放一个不属于 fast bin 的 chunk，并且该 chunk 不和 top chunk 紧邻时，该 chunk 会被首先放到 unsorted bin 中

分配时，如果在unsorted bin里没找到合适的chunk，则把unsorted bin里的chunk分配到small 和 large里，，然后再在 bin 中分配合适的 chunk



### 内存分配流程

 ![](/img/ctf-pwn/heapexploitation/1.jpg)

### 内存释放流程

 ![](/img/ctf-pwn/heapexploitation/2.jpg)



### tcache相关知识

以下全是64位机器来说

tcache从2.26开始才有，tcache同fastbin，先进后出，不动inuse

tcache出现后，每次产生堆都会先产生一个0x250大小的堆块，位于堆的开头。这0x250中（header占16字节），前0x40字节，对应64条tcache的链表，描述每个链表中的个数（每个链表最多7个chunk），然后0x200字节对应每个链表的开头地址。

tcache的64个链表从0x20开始，到0x410结束，公差16字节

tcache的链表指针指向的是chunk的content，而不是开头

> 在老的2.27中没有doublefree检查




### 参考文献

[Heap Exploitation](https://heap-exploitation.dhavalkapil.com/)

[Understanding glibc malloc](https://sploitfun.wordpress.com/2015/02/10/understanding-glibc-malloc/)

[Syscalls used by malloc](https://sploitfun.wordpress.com/2015/02/11/syscalls-used-by-malloc/)

[glibc 内存管理 ptmalloc 源代码分析](https://paper.seebug.org/papers/Archive/refs/heap/glibc内存管理ptmalloc源代码分析.pdf)

[Painless intro to the Linux userland heap](https://sensepost.com/blog/2017/painless-intro-to-the-linux-userland-heap/)