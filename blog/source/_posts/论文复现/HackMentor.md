---
title: HackMentor论文复现
tags: [papers reproduction]
date: 2023-11-30 13:24:00
categories: [论文复现]
excerpt: llm微调
---

### HackMentor

官方代码地址：<https://github.com/tmylla/HackMentor/tree/main>

论文：https://github.com/tmylla/HackMentor/blob/main/HackMentor.pdf

llm的一个微调，用于安全领域知识问答，复习一下pytorch和lora



#### 加载 base model 和 lora model

```python
import transformers, torch
from peft import PeftModel
def load_lora_model(base_model, lora_model, device_map="auto"):
    global model, tokenizer, generator

    print("Loading "+base_model+"...")

    if device_map == "zero":
        device_map = "balanced_low_0"

    # config
    gpu_count = torch.cuda.device_count()
    print('gpu_count', gpu_count)

    tokenizer = transformers.LlamaTokenizer.from_pretrained(base_model)
    model = transformers.LlamaForCausalLM.from_pretrained(
        base_model,
        device_map="auto",
        torch_dtype=torch.float16,
        low_cpu_mem_usage=True,
        load_in_8bit=False,
        cache_dir="cache"
    ).cuda()

    print("Loading "+lora_model+"...")
    model = PeftModel.from_pretrained(
        model,
        lora_model,
        torch_dtype=torch.float16
    )
    generator = model.generate
```

#### 使用model

```python
    fulltext = ......
    generated_text = ""
    gen_in = tokenizer(fulltext, return_tensors="pt").input_ids.cuda()
    in_tokens = len(gen_in)
    with torch.no_grad():
        generated_ids = generator(
            input_ids = gen_in,
            max_new_tokens=2048,  # 生成结果的长度上限
            use_cache=True,
            pad_token_id=tokenizer.eos_token_id, # 用于指示文本结束的标记
            num_return_sequences=1, # 生成的文本序列数量
            do_sample=True,
            repetition_penalty=1.1, # 控制模型生成重复标记的倾向性，数值越大，生成的文本中重复性越低
            temperature=0.6, # 用于控制生成的多样性。较高的温度会增加标记的随机性
            top_k = 50, # 在生成过程中，只有概率排名在前K位的标记才会被考虑
            top_p = 1.0, # 在生成过程中，累积概率达到给定值p时停止考虑更低概率的标记
            early_stopping=True, # 一个布尔值，控制生成过程是否在遇到pad_token_id后停止
        )
        generated_text = tokenizer.batch_decode(generated_ids, skip_special_tokens=True)[0] 
        text_without_prompt = generated_text[len(fulltext):]

    response = text_without_prompt
    response = response.split(human_invitation)[0]
    response.strip()
```

#### 训练

```python
trainer = transformers.Trainer(
    model=model,
    train_dataset=train_data,
    eval_dataset=val_data,
    args=transformers.TrainingArguments(
        per_device_train_batch_size=micro_batch_size,
        gradient_accumulation_steps=gradient_accumulation_steps,
        warmup_steps=100,
        num_train_epochs=num_epochs,
        learning_rate=learning_rate,
        fp16=True,
        logging_steps=1,
        optim="adamw_torch",
        evaluation_strategy="steps" if val_set_size > 0 else "no",
        save_strategy="steps",
        eval_steps=eval_step if val_set_size > 0 else None,
        save_steps=save_step,
        output_dir=output_dir,
        save_total_limit=20,
        load_best_model_at_end=True if val_set_size > 0 else False,
        ddp_find_unused_parameters=False if ddp else None,
        group_by_length=group_by_length,
        report_to="wandb" if use_wandb else "tensorboard",
        run_name=wandb_run_name if use_wandb else None,
    ),
    data_collator=transformers.DataCollatorForSeq2Seq(
        tokenizer, pad_to_multiple_of=8, return_tensors="pt", padding=True
    ),
)
model.config.use_cache = False

old_state_dict = model.state_dict
model.state_dict = (
    lambda self, *_, **__: get_peft_model_state_dict(
        self, old_state_dict()
    )
).__get__(model, type(model))

# if torch.__version__ >= "2" and sys.platform != "win32":
#     model = torch.compile(model)

trainer.train(resume_from_checkpoint=resume_from_checkpoint)
model.save_pretrained(output_dir)
```

#### 训练过程中的问题

所有epoch跑完以后，应该是在save_pretrained里报错

`SafetensorError: Error while deserializing header: InvalidHeaderDeserialization`

<https://github.com/huggingface/transformers/issues/27397> 里说，把 `model = torch.compile(model)`删掉，但是删掉之后又跑了一个epoch，还是报错

