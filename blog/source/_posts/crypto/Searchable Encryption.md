---
title: Searchable Encryption
tags: [crypto,论文笔记]
date: 2024-04-01 13:04:00
categories: [crypto]
excerpt: 可搜索加密
---

## Searchable Encryption

###  对称可搜索加密 SSE

#### 1. Practical Techniques for Searches on Encrypted Data 

Dawn Xiaodong Song, David Wagner, Adrian Perrig

University of California, Berkeley

2000年S&P

**对称可搜索加密（Symmetric Searchable Encryption，SSE）**

第一篇可搜索加密的论文，总结概括下来就是摘要里的这几句话：

“untrusted server cannot learn anything about the plaintext when only given the ciphertext”

”untrusted server cannot learn anything more about the plaintext than the search result“

“untrusted server cannot search for an arbitrary word without the user’s authorization”

“user may ask the untrusted server to search for a secret word without revealing the word to the server”

论文从一个basic scheme开始，逐步改进，最终提出自己的方法

**(1) Basic Scheme**

Alice将一个文档分割（可以按照段落分、按照句子分、按照单词分、按照任意长度bit分），这些单元叫做${W_{1},W_{2}...W_{l}}$，对分割出来的每个单元进行加密

加密的方法是用一个G（伪随机生成器）生成的随机数据流$S_{1},S_{2}...S_{l}$，再用一个F（伪随机生成函数），对每一个$S_{i}$用$k_{i}$加密成$T_{i}=<S_{i},F_{k_{i}}(S_{i})>$，密文 $C_{i} = T_{i} \oplus W_{i}$   把密文发送给服务器

> 这里的$k_{i}$是用户自己挑选的，可以全是一样的，也可以不一样

这时Alice想查询W，要告诉服务器W和**W可能出现在哪里**（也就是一堆$k_{i} $），服务器全都异或一遍，观察是否满足$<S_{i},F_{k_{i}}(S_{i})>$的形式，判断解密是否成功

**缺点**：这并不是全文搜索，而是从Alice给出的一个小范围内进行搜索，如果给的范围大了就会泄露更多的信息。

**(2) Controlled Searching**

上面这个只能在一个小范围内进行搜索的原因是，服务器没法知道查询的这个W的密文长什么样，不得不给他一个解密的范围

用一个新的伪随机生成函数$f$，一个新的用户自定义的密钥$k’$，$f_{k'}(W)$作为$k_{i}$，进行加密，查询时改为发送$k_{i}$和W

这样的好处是服务器可以根据W算出来T，（用户也就知道每个明文的密钥是谁，不再像前面那个密钥和明文对不上）因此可以对明文为W的密文进行解密，明文不是W时这个密钥也不好使

**缺点**：还是一个明文搜索，需要传过去明文W

**(3) Hidden Searching**

首先对明文进行加密，使用ECB模式的分组密码，把每一个单元都加密从${W_{1},W_{2}...W_{l}}$变成${X_{1},X_{2}...X_{l}}$

$T_{i}=<S_{i},F_{k_{i}}(X_{i})>$，$C_{i}=X_{i}\oplus T_{i}$，搜索时发送$k=f_{k'}(X)$和$X$，除了把W换成X和上一个都一样

**(4) Final Scheme**

3中的问题在于，服务器搜索出来一堆$C_{i}$返回给Alice，但是她不知道这些C都如何解密（因为他不知道是哪个X加密过来的，也就不知道k，也就无法计算T，也就无法从C得到X）

加密时把X分为左右两部分（左半部分和S相同长度）

$X=<L,R>$，$k_{i}=f_{k'}(L_{i})$，$C_{i}=X_{i}\oplus T_{i}=<L_{i},R_{i}>\oplus <S_{i},F_{k_{i}}(S_{i})>$

这时查询返回来一个$C_{j}$，虽然我不知道$k_{j}$是多少，但我只计算前$len(S_{j})$个长度的异或，就能得到$L_{j}$

然后用得到的$L_{j}$去计算$k_{j}$，这样就能解密右边了



#### 2. Secure Indexes

2003年，作者Eu-Jin Goh，斯坦福大学

https://eprint.iacr.org/2003/216.pdf

和第1篇Song的文章一样，也是一个SSE，主要思想在于提出了一个基于索引的可搜索加密，在Song的文章中没有涉及关于“服务器如何查找”这方面的内容。

他们提出了Z-IDX，是一种基于Bloom过滤器的安全索引机制，它允许用户在不泄露文件内容的情况下，对加密的文件执行关键词搜索。

1. **初始化Bloom过滤器**：对于每个文件，初始化一个m位的二进制向量（Mem），所有位初始设为0。这个向量将用于构建Bloom过滤器，用于跟踪文件中的关键词。

2. **选择哈希函数族**：定义一个哈希函数族${h_{1}(·), h_{2}(·), …, h_{r}(·)}$，其中每个$h_{i}$函数将输入映射到{1, 2, …, m}的整数范围内。这些函数用于将关键词映射到Bloom过滤器的位上。

3. **构建索引**：

- 对于文件中的每个关键词$W_{i}$，首先使用伪随机函数族${f_{1}(·, K_{1}), f_{2}(·, K_{2}), …, f_{r}(·, K_{r})}$生成一个代码字（codeword）。这里的$K_{1}, K_{2}, …, K_{r}$是主密钥$K_{pirv}$的子密钥。
- 然后，对于每个生成的$x_{i}$（伪随机函数输出结果），使用另一个伪随机函数${f(·, id)}$，其中id是文件的唯一标识符，生成最终的码字${y_{i1}, y_{i2}, …, y_{ir}}$。
- 将码字的每个位$y_{i}$映射到Bloom过滤器的相应位置，如果位置为0，则将其置为1。
- 为了增加安全性，还会向Bloom过滤器中随机插入若干个1，这样即使攻击者知道某些关键词的存在，也无法准确判断出文件中确切的关键词数量。

> 构建索引的过程就是：关键词通过两次伪随机函数作用形成codeword存储于索引中
>
> 第1次伪随机函数以关键词$W_{i}$为输入,分别在子密钥$K_{1},K_{2},…,K_{r}$*作用下生成*$x_{i1},x_{i2},…,x_{ir}$;
>
> 第2次伪随机函数分别以$x_{i1},x_{i2},…,x_{ir}$为输入,在当前文件标识符*id*作用下生成码字$y_{i1},y_{i2},…,y_{ir}$确保了相同关键词在不同文件中形成不同码字.

当用户想要搜索文件$D_{id}$中是否包含关键词$W_{i}$时，首先使用主密钥$K_{priv}=(K_{1},K_{2},…,K_{r})$生成$W_{i}$的陷门$T_{i}=(x_{i1},x_{i2},…,x_{ir})$。

服务器基于$T_{i}$生成$W_{i}$的codeword $y_{i1},y_{i2},…,y_{ir}$

服务器判断$D_{id}$的索引Memid的$y_{i1},y_{i2},…,y_{ir}$位是否全为1，若是,则成功匹配。

**缺点**

空间代价上,服务器除存储密文文件本身外,还需记录文件索引,当文件较短时,其索引可能是文件长度的数倍,空间利用率较低；时间代价上,服务器检索需逐个文件地计算和判断,整个关键词查询操作时间消耗为*O*(*n*)(*n*为服务器上存储文件数目)



#### 3. Searchable Symmetric Encryption: Improved Definitions and Efficient Constructions

作者：*Reza Curtmola, Juan Garay, Seny Kamara, and Rafail Ostrovsky*

发表在CCS 2006上

https://eprint.iacr.org/2006/210.pdf

这篇文章和第2个类似，都是在服务器上构建索引来查找

**索引构建**

首先扫描全部文档$D$，生成$D(W_{i})$（表示每个关键词都有哪些文件标识符与之对应），$id(D_{ij})$表示对于关键词$W_{i}$，$D(W_{i})$中第$j$个文档标识符。

创建一个链表，每个节点都代表$D(W_{i})$的一个文档，选取一系列的密钥$K_{ij}$，指向下一个节点的指针$\Psi ()$。

节点的表示为：$N_{ij}=id(D_{ij})||K_{ij}||\Psi (K_{1},ctr+1)$

目的是用$K_{i0}$加密$N_{i1}$，然后$N_{i1}$中存放下一个节点的加密密钥$K_{i1}$，以此类推......

这一个链表的每一项的加密结果存在一个数组里，叫做数组A。

即$A[\Psi (K_{1},ctr)]=SKE.Encrypt(K_{i(j-1)},N_{ij})$

构建一个速查表$T$，用来加密存储关键词俩鸟$L_{W_{i}}$的首节点的位置以及密钥

$T$用一个伪随机置换$p(K_{3},W_{i})$来索引，$K_{3}$是一个子密钥

$T$的条目值时链表首节点的地址和密钥的加密形式，它存储了首节点$N_{i1}$的地址$addrA(N_{i1})$和用于揭秘该节点的密钥$K_{i0}$，这两个拼接起来与伪随机函数$f(K_{2},W_{i})$做异或，结果就是$T$的项值。

即$T[\pi(K_{3},W_{i})]=(addrA(N_{i1)}||K_{i0})\oplus f(K_{2},W_{i})$

**查询**

用户查询包含$W$的文档时，发送$T_{w}=(\pi_{K_{3}}(W||1),f_{K_{2}}(W))$，服务器找到W相关链表首节点的地址$T[\pi_{K3}(W)]$，异或$f_{K_{2}}(W)$，得到$L_{W}$首节点在A的地址，以及首节点加密使用的密钥，这时就可以遍历整个链表寻找关键词

这个方法避免了查询关键词时需要便利每个文件进行检索的缺陷





### 非对称可搜索加密 ASE

#### 1. Public Key Encryption with Keyword Search

Dan Boneh，Giovanni Di Crescenzo，Rafail Ostrovsky，Giuseppe Persiano

Stanford University

2004年欧密 International Conference on the Theory and Applications of Cryptographic Techniques

**非对称可搜索加密（asymmetric searchable encryption，ASE）**

处理多个用户使用同一个服务器的情况时比较方便

场景假设：Bob用Alice的公钥加密了一个邮件，在这段密文之后拼接了几个加密的关键词：$[E_{A_{pub}}[msg], PEKS(A_{pub},W_{1}),...,PEKS(A_{pub},W_{k})]$

这个邮件存在服务器上，Alice可以通过发送一个$T_{W}$的密文来在服务器上查询每个邮件是否包含$W$关键词

**$T_{W}$是如何生成的**

$Trapdoor(A_{priv},W)=T_{W}$，选择两个循环群$G_{1}$和$G_{2}$，以及一个双线性映射$e:G_{1}\times G_{2}$，选择$G_{1}$的生成元$g$，计算公钥$A_{pub}=g^{A_{priv}}$，计算关键词$W$的哈希值$H_{1}(W)$，这将是$G_{1}$的一个群元。计算$T_{W}=H_{1}(W)^{A_{priv}}$。

**服务器是如何检验的**

> 双线性映射（Bilinear Map）是一种特殊的函数，它在两个循环群的元素之间定义，并且满足以下性质：
>
> 1. **可计算性**：给定两个群元，可以有效地计算它们的双线性映射。
> 2. **双线性**：对于所有群元g1,g2∈G1和所有整数x,y，有$e(g_{1}^{x},g_{2}^{y})=e(g_{1},g_{2})^{xy}$。
> 3. **非退化性**：如果g是G1的生成元，则e*(*g,g)是G2的生成元。
>

服务器接收一个加密的关键词$S$，和一个$T_{W}$，服务器检验S是否和服务器中的每个W是否匹配。

计算$e(T_{W},S_{1})$其中$S_{1}$是$S$的一个群元。从S中提取另一个群元$S_{2}$，计算$H_{2}(e(T_{W},S_{1}))$，$H_{2}$是一个将群$G_{2}$映射到一个固定长度比特串的哈希函数，如果和$S_{2}$相等，就是匹配成功。

依赖的难题是计算性Diffie-Hellman问题（Computational Diffie-Hellman Problem，简称CDH）：给定循环群G1中的生成元g和$g^{a},g^{b}∈G1$，计算$g^{ab}$是困难的。



### 关键词的布尔表达式检索

#### Highly-Scalable Searchable Symmetric Encryption with Support for Boolean Queries

David Cash 等，Rutgers University

2013年，International Cryptology Conference

**也是对称可搜索加密，但是支持连接搜索和一般的布尔查询**

场景描述：一个数据库（比如一个邮件服务器）$DB=(ind_{i},W_{i})_{i=1}^{d}$，表示各个邮件的编号$ind$和关键词$W$的pairs。$\Psi (\bar w)$代表满足一群关键词$W$的布尔表达式。

**EDBSetup**

初始化：$K_{S}$：用于加密ind的密钥。$K_{X}$和$K_{I}$：用于生成 xtrap 和 xind 值的密钥。$K_{Z}$：用于生成盲化因子的密钥。$K_{T}$用于生成w的标签的密钥。两个空的$T$数组和$XSet$数组。$F$和$F_{P}$都是为随机函数。

$xtrap=F(K_{X},w)$生成与每个关键词$w$相关的trap

对于每个$w$

1.  $K_{e}=Enc(K_{S},w)$ 对关键词进行了加密
2. 对于$w$相关的所有ind
   1. $xind=F_{P}(K_{I},ind)$作为$ind$的伪随机表示，$z=F_{P}(K_{Z},w||c)$，c是与w相关的文档计数器，z是生成的盲化因子
   2. $e=Enc(K_{e},ind)$，把$(e,xind*z^{-1})$加到$T$中
   3. $xtag=g^{F_{P}(K_{X},w)*xind}$，加到$XSet$中

$(TSet,K_{T})=TSetSetup(T)$ *文中没看到这个TSetSetup怎么实现的，只描述了它的功能是生成$TSet$和$K_{T}$*

输出$K_{S}$$K_{X}$$K_{I}$$K_{T}$$K_{Z}$和$EDB=(TSet,XSet)$

> EDB就是给服务器存储的一种加密之后的DB，存储与关键词相关联的数据元组，XSet存的辅助后面搜索的信息
>

**Search**

客户端有一个$w$的布尔表达式$\bar{w}$，计算

1. $stag=TSetGetTag(K_{T},w_{1})$

2. $xtoken[c,i]=g^{F_{P}(K_{Z},w_{1}||c)*F_{P}(K_{X},{w_{i})}}$
3. $xtoken[c]=xtoken[c,2],...,xtoken[c,n]$

把e(stag, xtoken[1], xtoken[2],...) 发送给服务器

服务器计算$t=TSetRetrieve(TSet,stag) $，在t中检索每个项目$(e,y)$，如果$xoken[c,i]^{y}\in XSet$，把e返回给客户

客户端计算$K_{e}=F(K_{S}，w_{1})$，对每个收到的e，计算$ind=Dec(K_{e},e)$得到结果





