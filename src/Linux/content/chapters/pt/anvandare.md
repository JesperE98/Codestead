# Usuários e grupos

O Linux foi feito desde o início para que muitas pessoas compartilhassem o
mesmo computador ao mesmo tempo. Todo arquivo tem um dono e todo programa
roda como um determinado usuário – por isso criar, alterar e remover contas é
uma das tarefas mais importantes de um administrador. Neste capítulo você
cria o usuário `kim`, dá à conta uma senha e direitos de sudo e aprende onde
tudo isso fica guardado.

## Usuários e UIDs

Você já sabe descobrir quem você é:

```sh
whoami
id
```

O `id` mostra que você não tem só um nome, mas também um número: `uid=1000`.
Esse é o **UID** (*user ID*), e é o número – não o nome – que o kernel
acompanha. O nome só existe para que nós, humanos, não precisemos decorar
números. Alguns números importantes:

| UID | Quem |
|---|---|
| `0` | **root**, o administrador. Quem tem UID 0 pode fazer qualquer coisa. |
| `1`–`999` | **Usuários de sistema** para serviços e programas |
| `1000` em diante | **Usuários comuns** – pessoas. O primeiro recebe 1000. |

## A lista de usuários – `/etc/passwd`

Todos os usuários estão listados no arquivo de texto `/etc/passwd`, uma linha
por usuário:

```sh
cat /etc/passwd
```

Cada linha tem sete campos separados por dois-pontos. Olhe a sua própria
linha:

```sh
grep {{user}} /etc/passwd
```

```text
{{user}}:x:1000:1000:{{userFull}},,,:/home/{{user}}:/bin/bash
  1   2  3    4     5          6          7
```

| Campo | Significado |
|---|---|
| 1 | O nome de usuário |
| 2 | `x` – a senha fica em `/etc/shadow` (veja abaixo) |
| 3 | UID |
| 4 | GID – o número do **grupo primário** do usuário |
| 5 | Comentário, normalmente o nome completo |
| 6 | O diretório pessoal |
| 7 | O shell iniciado quando o usuário faz login |

O comando `getent` faz a mesma consulta. A diferença é que ele também
encontra usuários que não estão no arquivo, por exemplo em uma escola ou
empresa onde as contas ficam em um servidor central:

```sh
getent passwd {{user}}
```

### Usuários de sistema

A maioria das linhas em `/etc/passwd` não são pessoas. Serviços como o
servidor web e o sistema de logs rodam como usuários próprios, com o mínimo de
direitos possível – se forem invadidos, o atacante não alcança os seus
arquivos. Eles têm o shell `nologin`, então ninguém consegue fazer login como
eles. No Ubuntu o usuário do servidor web se chama `www-data` (os nomes dos
usuários de sistema variam entre as distribuições):

```sh
grep www-data /etc/passwd
```

Com o `awk`, que você vai conhecer melhor no capítulo de processamento de
texto, você pode listar todos com UID 1000 ou mais – os usuários comuns:

```sh
awk -F: '$3 >= 1000 {print $1}' /etc/passwd
```

O `nobody` (UID 65534) também aparece. Ele é um usuário especial que é dono
de "nada" e é usado quando um programa deve ter o mínimo de direitos possível.

```predict
$ awk -F: '$3 == 0 {print $1}' /etc/passwd
root
---
O campo 3 é o UID, e só o root tem UID 0. É o número, não o nome, que dá ao
root os seus poderes.
```

## Grupos e GIDs

Um **grupo** é uma forma de dar a vários usuários os mesmos direitos, por
exemplo a um diretório de projeto compartilhado. Os grupos estão listados em
`/etc/group`:

```sh
cat /etc/group
```

```text
sudo:x:27:{{user}}
 1   2  3   4
```

Os campos são o nome do grupo, `x`, o número do grupo (**GID**) e uma lista
de membros separada por vírgulas.

Todo usuário tem **um grupo primário** (o campo GID em `/etc/passwd`) e pode
também ser membro de quantos **grupos suplementares** quiser. Arquivos novos
que você cria recebem o seu grupo primário. Na maioria das distribuições,
todo usuário recebe um grupo primário particular com o mesmo nome – `{{user}}`
está no grupo `{{user}}`.

```sh
groups
id
```

```quiz
Você (`{{user}}`) está nos grupos `{{user}}` e `sudo`, e o seu grupo primário é
`{{user}}`. Qual grupo um arquivo novo que você cria recebe?
- [x] `{{user}}`
- [ ] `sudo`
- [ ] Os dois
- [ ] `root`
---
Arquivos novos recebem o seu grupo **primário** – o campo GID em `/etc/passwd`.
Grupos suplementares como o `sudo` dão direitos extras a você, mas não vão
parar nos seus arquivos.
```

## As senhas – `/etc/shadow`

Repare no `x` do campo 2 de `/etc/passwd`. Antigamente a senha
(criptografada) ficava ali mesmo. O problema é que `/etc/passwd` **precisa**
ser legível por todos – é de lá que o `ls -l` tira os nomes dos donos. Então
qualquer um poderia copiar as senhas criptografadas e tentar quebrá-las com
toda a calma. Por isso elas foram movidas para `/etc/shadow`, que só o root
pode ler:

```sh
ls -l /etc/passwd /etc/shadow
sudo cat /etc/shadow
```

```text
kim:$y$j9T$Tm9...$Kx2...:20756:0:99999:7:::
```

O campo 2 não é a senha em si, mas um **hash** – uma "impressão digital" que
não pode ser revertida. Quando você faz login, o hash do que você digitou é
calculado e comparado com o guardado. `$y$` significa que o método
*yescrypt* é usado. Um `!` ou `*` no lugar significa que não há senha, ou que
a conta está **bloqueada**. Os campos restantes tratam de quando a senha foi
alterada pela última vez e de quando ela expira. O `chage` os mostra em texto
claro:

```sh
chage -l {{user}}
```

```try
chage -l {{user}}
---
`Password expires: never` – a senha do {{user}} nunca precisa ser alterada.
```

## Criando um usuário – `useradd`

Criar usuários exige root. O comando mais comum existe em todas as
distribuições:

```sh
sudo useradd -m -s /bin/bash kim
```

| Opção | Significado |
|---|---|
| `-m` | Cria o diretório pessoal `/home/kim` |
| `-s /bin/bash` | O shell do usuário |
| `-c "Kim Souza"` | O comentário (nome completo) |
| `-G grupo1,grupo2` | Grupos suplementares desde já |

O `useradd` encontra o próximo UID livre a partir de 1000 – `kim` recebe o 1001.
Os limites ficam em `/etc/login.defs`. Um grupo `kim` também é criado, e
os arquivos de `/etc/skel` (*skeleton*, esqueleto) são copiados para o novo
diretório pessoal. Coloque algo ali e todo usuário novo vai recebê-lo:

```sh
ls -a /etc/skel
```

No Ubuntu o `useradd` é econômico: sem `-m` **nenhum** diretório pessoal é
criado, e sem `-s` o shell vira `/bin/sh`. Outras distribuições têm outros
padrões, então se acostume a digitar `-m` e `-s` – assim o mesmo comando
funciona em todo lugar.

Por isso o Ubuntu também tem o script mais amigável `adduser`, que é da
família Debian. Ele cria o diretório pessoal, escolhe o bash e pergunta a
senha e o nome:

```sh
sudo adduser lisa
```

Responda às perguntas – na maioria delas você pode só apertar Enter. O
`adduser` também sabe adicionar um usuário existente a um grupo:
`sudo adduser lisa sudo`.

O `useradd`, o `passwd` e os outros comandos deste capítulo estão sempre
instalados. No Ubuntu eles vêm no pacote `passwd`; outras famílias dão outro
nome ao pacote.

## Definindo uma senha – `passwd`

Uma conta nova não tem senha (`!` em `/etc/shadow`), então ninguém consegue
fazer login nela. Defina uma com `passwd`:

```sh
sudo passwd kim
```

Você digita a senha duas vezes. **O que você digita não aparece** – nada de
asteriscos, nada. Isso é de propósito: quem estiver olhando por cima do seu
ombro não deve ver nem o tamanho da senha. Digite-a e aperte Enter.

O `passwd` sem nome altera a sua própria senha. Só o root pode alterar a
senha de outros usuários – experimente sem sudo:

```sh
passwd root
```

## Grupos – `groupadd`, `usermod -aG` e `gpasswd`

Crie um grupo e adicione um membro:

```sh
sudo groupadd {{devGroup}}
sudo usermod -aG {{devGroup}} kim
groups kim
```

`-aG` significa *append to Groups* (acrescentar aos grupos). **Não esqueça o
`-a`!** Só com `-G` a lista de grupos suplementares passa a ser exatamente o
que você digitar – e o usuário é removido de todos os outros grupos, como o
grupo do sudo. Uma forma comum de se trancar para fora.

```quiz
A `kim` está nos grupos suplementares `sudo` e `{{devGroup}}`. Um
administrador executa `sudo usermod -G backup kim`. Em quais grupos
suplementares a kim fica depois?
- [ ] `sudo`, `{{devGroup}}` e `backup`
- [x] Só `backup`
- [ ] `sudo` e `{{devGroup}}` – o comando falha sem `-a`
- [ ] Nenhum
---
Sem `-a` a lista passa a ser exatamente o que você digitar. Com
`sudo usermod -aG backup kim` a kim teria mantido os outros grupos.
```

O `gpasswd` faz a mesma coisa e também sabe remover membros:

```sh
sudo gpasswd -a kim {{devGroup}}
sudo gpasswd -d kim {{devGroup}}
```

Em um computador de verdade, uma nova participação em grupo só vale na
próxima vez que o usuário fizer login. O simulador é mais gentil – aqui ela
vale na hora.

Grupos são usados para diretórios compartilhados. Faça do grupo o dono e dê a
ele permissão de escrita com `chgrp` e `chmod`:

```sh
sudo mkdir /srv/projeto
sudo chgrp {{devGroup}} /srv/projeto
sudo chmod 775 /srv/projeto
ls -ld /srv/projeto
```

## Dando direitos de sudo – o grupo `sudo`

Quem pode usar o `sudo` é decidido em `/etc/sudoers`:

```sh
sudo cat /etc/sudoers
```

A linha `%sudo ALL=(ALL:ALL) ALL` significa que todos no grupo **sudo**
podem executar qualquer comando como root. Então, dar direitos de sudo a
alguém é só uma questão de adicioná-lo ao grupo certo – no Ubuntu, o grupo
`sudo`:

```sh
sudo usermod -aG sudo kim
```

O grupo tem nomes diferentes em famílias diferentes: no Arch e no Fedora ele
se chama `wheel` – um antigo nome do Unix para "os que mandam" (*big wheel*,
figurão).

Nunca edite `/etc/sudoers` diretamente com um editor comum – um erro de
digitação pode fazer com que ninguém mais consiga usar o sudo. Use o
`visudo`, que verifica o arquivo antes de salvá-lo. Normalmente os grupos são
tudo de que você precisa.

## Trocando de usuário – `su` e `sudo -u`

Existem duas formas de virar outra pessoa:

| Comando | Senha de quem? | O que acontece |
|---|---|---|
| `su - kim` | **a da kim** | Você fica logado como kim até digitar `exit` |
| `sudo -u kim comando` | **a sua** (você precisa de direitos de sudo) | Um único comando roda como kim |
| `sudo -iu kim` | a sua | Um shell de login como kim |

```sh
sudo -u kim whoami
```

Com o `su` você troca de verdade. O hífen (`-`) faz disso um login: você vai
parar no diretório pessoal da kim, com as configurações da kim. O prompt mostra
quem você é, e o `exit` traz você de volta:

```sh
su - kim
```

`su` sem nome significa root. No Ubuntu o root não tem senha, então o `su -`
não funciona lá – use `sudo -i`.

```quiz
Você quer executar um único comando como `kim`, mas não sabe a senha da
kim. Você tem direitos de sudo. O que funciona?
- [ ] `su - kim`
- [x] `sudo -u kim command`
- [ ] `su kim command`
- [ ] Nada – você precisa da senha da kim
---
O `su` pede a senha do usuário em que você se transforma. O `sudo` pede a **sua
própria** senha e verifica em `/etc/sudoers` se você pode fazer isso.
```

## Bloqueando e excluindo contas

Uma conta que não deve ser usada por um tempo pode ser **bloqueada**. O
`usermod -L` coloca um `!` na frente do hash em `/etc/shadow`, de modo que
nenhuma senha bate mais. O `-U` desbloqueia:

```sh
sudo usermod -L kim
sudo passwd -S kim
sudo usermod -U kim
```

O `passwd -S` mostra o status: `P` (tem senha), `L` (bloqueada) ou `NP` (sem
senha). Com `chage -E` uma conta pode expirar em uma data determinada – útil
para temporários e substitutos.

Antes de excluir alguém, pode ser bom ver quem está logado e quando alguém
esteve logado pela última vez:

```sh
who
last
```

Depois o `userdel` remove o usuário. Com `-r` o diretório pessoal vai junto –
sem `-r` os arquivos ficam para trás:

```sh
sudo useradd -m {{tempUser}}
sudo userdel -r {{tempUser}}
```

O Ubuntu também tem o `deluser`, a contrapartida do `adduser`:
`sudo deluser --remove-home {{tempUser}}`. `sudo deluser kim sudo` remove a kim do
grupo sudo.

O `userdel` se recusa a excluir um usuário que está logado – experimente
`sudo userdel {{user}}`.

## Resumo

| Comando | Faz |
|---|---|
| `id`, `groups` | Mostra UID, GID e grupos |
| `useradd -m -s /bin/bash nome` | Cria um usuário |
| `passwd nome` | Define uma senha |
| `usermod -aG grupo nome` | Adiciona a um grupo |
| `groupadd grupo` | Cria um grupo |
| `usermod -L` / `-U` | Bloqueia / desbloqueia |
| `userdel -r nome` | Exclui o usuário e o diretório pessoal |
| `su - nome`, `sudo -u nome` | Troca de usuário |
| `/etc/passwd`, `/etc/group`, `/etc/shadow` | Onde tudo fica guardado |
