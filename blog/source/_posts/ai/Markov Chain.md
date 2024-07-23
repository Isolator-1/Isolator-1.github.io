---
title: Markov Chain
tags: [machine-learning]
date: 2023-11-19 00:16:00
categories: [machine-learning]
excerpt: Markov Property, Hidden Markov, POMDP
---

#### Markov Property

未来状态的概率分布只与当前状态有关，而与过去状态无关

$P_{s's}$是从$s'$到$s$的状态转移概率，$P$是一个状态转移矩阵

$$P=\begin{bmatrix}
  &P_{11}  &P_{12}  &... &P_{1n} \\
  & ...  &  & \\
  & ... &  & \\
  & ... &  & \\
  & P_{n1} &...  & &P_{nn}
\end{bmatrix}$$ 

时间和状态都是离散的马尔科夫过程称为马尔科夫链，Markov Chain，状态转移概率不随事件发生变化

#### Hidden Markov Model （HMM）

假设有一个系统，他时刻的状态是可观察的，但即状态转移原理（即模型参数）是不可知的，这样的就是隐式马尔可夫模型

要做的就是通过观察状态的分布来定义模型的状态转移机制

这是一种统计模型

#### Markov Decision Process （MDP）

属于强化学习，给一个五元组$(S,A,P,R,\gamma)$，S是状态集合，A是动作集合，P表示状态转移概率，即在s状态下，采取a的动作，分别是多大的概率转变为哪个新状态，R是奖励函数，即转移到新状态的奖励，$\gamma$是奖励的权重比例

从一个初始状态寻求一个最优策略

Bellman提出了用动态规划来解决这类问题

#### Partially Observable MDP （POMDP）

只有部分的状态是可观测到的MDP，人们只能看到一个“观察值”，不能直接了解到内部状态

比前一个五元组多了一个$Z$和$O$，$O$代表在执行了一个动作a之后，在一个状态s产生一个观测z的概率