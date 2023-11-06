---
title: 0ctfbabyheap 
tags: [ctf-pwn,exp]
date: 2023-11-04 10:42:00
categories: [ctf-pwn]
excerpt: 一道通过unsorted bin的fd泄露libc基址，然后用fastbin double free getshell的例题
---

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