# Экзамен: Другие инструменты

Четырнадцать вопросов о git и других shell. Для сдачи нужно 80 % правильных
ответов. Вопросы с командами начинаются в новом терминале, поэтому сначала
они устанавливают нужную программу – `> /dev/null 2>&1` выбрасывает вывод
этих строк.

```quiz
Вы изменили `index.html` и создали новый файл `kontakt.html`. Вы выполняете
`git commit -am "Contact page"`. Что попадёт в коммит?
- [x] Только изменение в `index.html`
- [ ] Только `kontakt.html`
- [ ] Оба файла
---
`-a` добавляет все изменённые файлы, которые git уже отслеживает, – но никогда
не добавляет новые. `kontakt.html` нужно сначала добавить через `git add`.
```

```quiz
Вы выполнили `git add` для изменения в `style.css`. Какая команда покажет это
изменение?
- [ ] `git diff`
- [x] `git diff --staged`
- [ ] `git log`
---
`git diff` сравнивает рабочий каталог с индексом, поэтому, как только изменение
попало в индекс, она ничего не показывает. `--staged` показывает то, что ждёт
коммита.
```

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y git > /dev/null 2>&1
$ git config --global user.name "Elev Elevsson"
$ git config --global user.email "elev@example.com"
$ cd ~/projekt-webb && git init > /dev/null 2>&1
$ git add . && git commit -m "Första versionen" > /dev/null
$ git switch -c ny-design > /dev/null 2>&1
$ echo 'h1 { color: purple; }' >> style.css
$ git commit -am "Lila rubriker" > /dev/null
$ git switch main > /dev/null 2>&1
$ git merge ny-design > /dev/null
$ git log --oneline | wc -l
2
---
`main` не менялась с момента создания ветки, поэтому слияние было
*fast-forward*: git лишь передвинул `main` вперёд на коммит `ny-design`.
Коммит слияния не создавался.
```

```quiz
Что такое ветка в git с технической точки зрения?
- [ ] Полная копия всех файлов проекта
- [x] Метка, которая указывает на коммит и сдвигается, когда вы делаете новые коммиты
- [ ] Отдельный репозиторий со своим каталогом `.git`
---
Именно поэтому ветки в git дешёвые – пользуйтесь ими почаще.
```

```quiz
`git merge` остановился с конфликтом в `index.html`. Вы исправили файл и
удалили строки-маркеры. Что делать дальше?
- [ ] Снова выполнить `git merge`
- [x] `git add index.html`, а затем `git commit`
- [ ] `git restore index.html`
---
`git add` сообщает git, что конфликт разрешён, а `git commit` завершает
слияние. `git restore` отбросил бы ваше исправление.
```

```quiz
Файл `fel.log` закоммитили по ошибке. Вы добавляете `*.log` в `.gitignore`,
но git всё ещё отслеживает файл. Как удалить его из репозитория, но оставить
на диске?
- [ ] `rm fel.log`
- [x] `git rm --cached fel.log`
- [ ] `git restore fel.log`
---
`.gitignore` действует только на файлы, которые git ещё не отслеживает.
`--cached` удаляет файл из git, но оставляет его на диске.
```

```quiz
Какая команда получает новые коммиты из удалённого репозитория, **не** сливая
их с вашими?
- [ ] `git pull`
- [x] `git fetch`
- [ ] `git push`
- [ ] `git clone`
---
`git pull` получает и сливает; `git fetch` только получает.
```

```quiz
Какие из этих изменений теряются навсегда? Выберите все подходящие варианты.
- [x] Изменения в файле, которые ни разу не коммитились и были отброшены через `git restore`
- [x] Изменения, которые ни разу не коммитились и были отброшены через `git reset --hard`
- [ ] Коммит, сделанный вчера, до того как вы выполнили `git reset --hard`
---
Всё, что когда-то было закоммичено, почти всегда можно спасти –
`git reflog` показывает, где вы побывали.
```

```quiz
Вы запустили zsh из bash. Какая команда покажет shell, который работает прямо
сейчас?
- [x] `echo $0`
- [ ] `echo $SHELL`
- [ ] `cat /etc/shells`
---
`$SHELL` – ваш login shell, по-прежнему `/bin/bash`. В `/etc/shells`
перечислены shell, которые можно использовать как login shell.
```

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y fish > /dev/null 2>&1
$ fish -c 'math 10 / 4'
2.5
---
`math` умеет работать с дробными числами.
```

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y fish > /dev/null 2>&1
$ fish -c 'false; echo $status'
1
---
В fish код возврата последней команды называется `$status` – а `false`
всегда завершается с ошибкой.
```

```quiz
Как в fish сделать `EDITOR` переменной окружения со значением `nano`?
- [ ] `export EDITOR=nano`
- [ ] `EDITOR=nano`
- [x] `set -x EDITOR nano`
- [ ] `set -e EDITOR nano`
---
`-x` экспортирует переменную; `-e` удаляет её.
```

```quiz
Какой файл читает zsh при запуске?
- [ ] `~/.bashrc`
- [x] `~/.zshrc`
- [ ] `~/.config/fish/config.fish`
- [ ] `/etc/shells`
```

```try
grep elev /etc/passwd
---
Последнее поле строки – ваш login shell, тот самый, который меняет `chsh -s`.
```
