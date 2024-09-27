---
title: mip汇编
tags: [assembly]
date: 2022-12-23 16:08:00
categories: [mips汇编]
excerpt: mips汇编基础知识
---

## MIPS汇编

1. 寄存器

   32个，$0 ~ $31，每个寄存器具体作用见 https://ctf-wiki.org/assembly/mips/readme/

   常见的包括：

| 寄存器  |            作用             |
| :-----: | :-------------------------: |
|   $0    |           恒定为0           |
| $4 - $7 | 函数参数，通常也叫$a0 - $a3 |
|   $29   |          $sp，栈顶          |
|   $30   |          $fp，栈帧          |
|   $31   |        $ra，返回地址        |

除了这32个寄出器，还有$PC和 HI、LO

2. 指令

   MIPS指令为load-store架构，操作数必须先从内存中读取到寄存器里才能运算，**不能直接操作内存**

   |  指令  |                             内容                             |
   | :----: | :----------------------------------------------------------: |
   |  beq   |                       branch on equal                        |
   |  bgez  |      branch on greater than or euqal to zero （≥0跳转）      |
   | bgezal | （al = and link）  $ra设置为下一条指令然后跳转，相当于跳转到一个函数 |
   |  bgtz  |           branch on greater than zero （＞0跳转）            |
   |  bne   |                     branch on not equal                      |
   |  jal   |       jump and link 过程调用，会将$ra设置为下一条指令        |

   运算：乘法会将结果高32位存入HI，低32位存入LO
   
   ​			除法会将余数存入HI，商存入LO
   
   三个操作数，都是将右边两个的计算存入左边的，例如 or $d,$s,$t ，d = s | t
   
   
   
   

