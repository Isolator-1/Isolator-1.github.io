---
title: 菜鸡的2022datacon记录
tags: [datacon,exp,iot-sec，powershell]
date: 2022-12-11 15:37:00
excerpt: 打开新世界的大门
---



#### 固件基地址识别

rbasefind - <https://github.com/sgayou/rbasefind>

此项目用rust写的，用`cargo build`之后会生成可执行文件在`target`路径下

```
rbasefind <path-to-bin> 
```

```sh
Located 4052 strings
Located 197089 pointers
Scanning with 2 threads...
0x2c0dc000: 3818
0x2c0dd000: 280
0x2c0db000: 274
0x2c0da000: 232
0x2c0de000: 228
0x2c0d7000: 202
0x2c0d9000: 200
0x2c0df000: 199
0x2c0e1000: 184
0x2c0e6000: 181
```

通常来讲第一行（也就是数字最大的那个）为固件的基地址，但是很多时候识别不出来（比如几行都是1）

实际在datacon的数据上测试的结果，使用的时候所有参数都是default（因为当时并没有仔细看代码....）

![](/img/datacon/1.jpg)

应该是50个固件识别成功了38个



##### 对rbasefind源码的分析

按程序执行顺序分析

1. `get_strings()`

   利用一个正则表达式匹配

   ```
   [ -~\t\r\n]{10,}  // 从空格(48)到制表符(126) 以及 \r\n 的所有有效字符 
   ```

   长度至少是10的字符串（10为参数minstrlen，最小字符串搜索长度）

2. `get_pointers()`

   提取整个文件的u32（？），会根据参数`big_endian`判断文件的大小端

3. `find_match() -> Interval::get_range()`

   把32位地址空间平均分为n部分，n位参数的threads（开启的线程数）

4. 每一个interval对应一个线程，以offset字节为一组（offset为输入的参数，默认为4096）

5. 下面的代码中current_addr遍历了` [interval.start_addr : interval.end_addr : offset]`

   将每个str的首地址加上current_addr，把这些地址和pointers集合取交集

   ```rust
   while current_addr <= interval.end_addr {
       let mut news = FnvHashSet::default();
       for s in strings {
           match s.checked_add(current_addr) {
               Some(add) => news.insert(add),
               None => continue,
           };
       }
       let intersection: FnvHashSet<_> = news.intersection(pointers).collect();
       if !intersection.is_empty() {
           heap.push((intersection.len(), current_addr));
       }
       match current_addr.checked_add(config.offset) {
           Some(_) => current_addr += config.offset,
           None => break,
       };
   }
   ```

6. 取出交集size最大的top n个current_addr进行输出

   见本节最开头的示例，输出格式为 addr :  interaction_size

   size最大的即认为是最有可能的基地址

   

   **目前尚不清楚这样做的道理是什么**

   猜测：首先，基地址是一个offset的倍数，那么遍历0~2^32所有offset的倍数（也就是current_offset），字符串在程序运行时会被装载到基地址后面的一段空间内，而pointers里会有很多指向字符串真实地址的指针，如果能将strings和pointers匹配上很多，说明这个current_addr就是程序的基地址

   （纯瞎猜:broken_heart:）

   

#### 函数符号恢复

