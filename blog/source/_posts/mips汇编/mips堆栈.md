---
title: mips的堆栈
tags: [assembly]
date: 2022-12-23 16:08:00
categories: [mips汇编]
excerpt: mips堆栈知识
---

#### MIPS的栈💣

1. 栈增长方向：同x86，向低地址增长

2. 没有EBP指针（但是有一个fp，见MIPS汇编这篇文章）
3. 传参：前四个参数通过$a0~$a3传递，多出的参数放入栈空间
4. 返回值：$RA寄存器 

#### mips与x86函数调用区别

1. 将$PC寄存器移到$RA寄存器
2. 如果被调用的函数是如果是非叶函数（调用其他函数），将$RA存在栈；叶函数则不变
3. 函数返回时，叶函数直接 `jr $RA`，非叶函数先把返回地址存入$RA再跳转

《家用路由器0day漏洞挖掘》这本书上的图例：

![](/img/mips/1.jpg)



#### 主调函数干的事

##### 演示

1. 创建 `more argument.c`

   ```C
   //more argument.c
   #include <stdio.h>
   int more_arg(int a,int b,int c,int d,int e)
   {
       char dst[100] = {0};
       sprintf(dst,"%d%d%d%d%d\n",a,b,c,d,e);
   }
   void main()
   {
       int a1=1;
       int a2=2;
       int a3=3;
       int a4=4;
       int a5=5;
       more_arg(a1,a2,a3,a4,a5);
       return ;
   }
   ```

2. 编译

   ```
   mips-linux-gnu-gcc ./more\ argument.c  -o   more\ argument
   ```

3. ida打开

   首先可以看到前四个参数存入了$a0~$a3

   ![](/img/mips/2.jpg)

   然后前面5个：
   
   ```assembly
   li      $v0, ?
   sw      $v0, 0x??+var_18($fp)
   ```
   
   是赋值操作，因此中间的
   
   ```assembly
   lw      $v0, 0x38+var_8($fp)
   sw      $v0, 0x38+var_28($sp)
   ```
   
   即为第五个参数的传递

   

#### 被调函数干的事

被调用函数的开头干了以下几件事（仅针对非叶函数）：

```assembly
addiu   $sp, -0x40
sw      $ra, 0x38+var_s4($sp)
sw      $fp, 0x38+var_s0($sp)
move    $fp, $sp
```

首先，抬高sp 0x40个字节***（这里0x40是随便写的）***。然后将ra放到`sp + 0x38 + 4`，fp放到`sp + 0x38 + 0`的位置，也就是被调函数的栈底为ra，然后是fp。最后将fp赋值为sp。

然后需要对参数进行处理，arg_0 到arg_C是主调函数预留出来的空间，需要被调函数再把$a0-$a3存入进去，然后arg_10本身主调函数就已经存好了第五个参数，不需要动。

![](/img/mips/3.jpg)





最终主调和被调函数的栈长这样：

![](/img/mips/4.jpg)