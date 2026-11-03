# A família Arch: pacman e o AUR

O Arch Linux e as distribuições baseadas nele, como o Manjaro e o
EndeavourOS, formam a **família Arch**. Elas usam o gerenciador de pacotes
**pacman** e pacotes no formato `.pkg.tar.zst`. Este capítulo sempre roda em
uma distribuição da família Arch – neste momento é o **{{distro}}**.

## O pacman em resumo

| O quê | Comando |
|---|---|
| Atualizar a lista de pacotes | `pacman -Sy` |
| Atualizar tudo | `pacman -Syu` |
| Instalar | `pacman -S X` |
| Remover | `pacman -R X` |
| Pesquisar | `pacman -Ss X` |
| Informações do pacote | `pacman -Si X` |
| Listar instalados | `pacman -Q` |

Os comandos que alteram o sistema exigem root, por isso são executados com
`sudo`.

O pacman usa opções curtas em que a **letra maiúscula** é a operação e as
letras minúsculas são modificadores:

| Opção | Significa |
|---|---|
| `-S` | Sync – instala a partir dos repositórios |
| `-R` | Remove |
| `-Q` | Query – consulta os pacotes instalados |
| `y` | Atualiza o banco de dados de pacotes |
| `u` | Atualiza todos os pacotes |
| `s` | Pesquisa (com -S e -Q) ou remove dependências (com -R) |
| `i` | Informações |

```quiz
O que o `Q` maiúsculo em `pacman -Q` significa?
- [ ] Quit – encerra o pacman
- [x] Query – consulta os pacotes instalados
- [ ] Quick – instala sem perguntar
---
O `-Q` consulta o que está instalado, o `-S` instala a partir dos repositórios
e o `-R` remove.
```

Pesquisar não exige root. Experimente:

```try
pacman -Ss htop
```

## Atualizando o sistema

```sh
sudo pacman -Syu
```

`-Syu` significa: sincronizar (`S`), atualizar o banco de dados (`y`) e
atualizar tudo (`u`). O Arch é uma *rolling release*, então você vai executar
isso com frequência.

> **Importante!** Nunca execute só `pacman -Sy` seguido de `pacman -S pacote`.
> O pacote novo pode precisar de bibliotecas mais novas do que as que você
> tem – é a chamada *atualização parcial* (*partial upgrade*), que pode
> quebrar o seu sistema. Sempre use `-Syu`.

```quiz
Por que você não deve executar `pacman -Sy` e depois `pacman -S pacote`?
- [ ] Porque o `-Sy` apaga o banco de dados de pacotes
- [x] O pacote novo pode precisar de bibliotecas mais novas do que as que você tem, o que pode quebrar o sistema
- [ ] Porque o pacman só consegue instalar um pacote por dia
---
Sempre atualize tudo de uma vez com `-Syu`.
```

## Instalando e removendo

```sh
sudo pacman -S htop
```

O `pacman -R pacote` remove um pacote, e o `pacman -Rs pacote` também remove
as dependências de que mais nada precisa.

## O AUR

Os repositórios da distribuição têm dezenas de milhares de pacotes – mas não
tudo. Um programa de nicho pode simplesmente não estar lá, ou estar só em uma
versão antiga. Na família Arch, a resposta é o **AUR** (*Arch User
Repository*).

O AUR é diferente dos repositórios comuns: ele não tem pacotes prontos, só
**receitas de build**. Uma receita se chama `PKGBUILD` e é um pequeno script
bash que diz onde está o código-fonte e como o programa é compilado. Você
baixa a receita, gera o pacote você mesmo e o instala com o pacman. O AUR é
enorme – quase tudo que existe para Linux está lá –, mas qualquer pessoa pode
enviar uma receita.

```quiz
O que você baixa do AUR?
- [ ] Um pacote `.pkg.tar.zst` pronto, revisado pelo Arch
- [x] Uma receita de build (`PKGBUILD`) a partir da qual você mesmo gera o pacote
- [ ] Um Flatpak
```

### Por sua conta e risco

Os pacotes dos repositórios da própria distribuição são testados em conjunto,
assinados e revisados pelos desenvolvedores da distribuição. Os pacotes do
AUR não são revisados pelo Arch. Tenha isso em mente:

- **Os pacotes são instalados como root.** Um pacote pode fazer qualquer coisa
  com o computador. Você confia em quem escreveu a receita tanto quanto
  confia na distribuição.
- **Pode dar conflito.** Um pacote pode substituir bibliotecas do próprio
  sistema ou precisar de versões diferentes das que você tem.
- **Ele pode deixar de ser atualizado.** Se a pessoa que mantém a receita
  perder o interesse, você não recebe mais atualizações de segurança para o
  programa.

Uma boa regra prática: procure primeiro nos repositórios da distribuição,
depois um Flatpak (no capítulo sobre pacotes universais) e só então no AUR.

No restante deste capítulo você instala um programa inventado, `moonphase`
(ele mostra a fase da lua no terminal), a partir do AUR.

### Preparativos

Para baixar receitas e gerar pacotes, você precisa do `git` e do `base-devel`
(um compilador, `make`, `fakeroot` e mais):

```sh
sudo pacman -S --needed git base-devel
```

`--needed` pula o que já está instalado.

### Baixando a receita

Cada pacote do AUR é um repositório git próprio:

```sh
cd ~
git clone https://aur.archlinux.org/moonphase.git
cd moonphase
ls
```

> Se você digitar o nome do pacote errado, o git diz *"You appear to have
> cloned an empty repository"* e o diretório fica vazio. O AUR deixa você
> clonar qualquer coisa!

### Leia o PKGBUILD – todas as vezes

```sh
less PKGBUILD
```

O `PKGBUILD` é um script que roda no seu computador. No mínimo, verifique:

- se o `source=` baixa do site verdadeiro do programa,
- se `build()` e `package()` só compilam e copiam arquivos – e não, por
  exemplo, baixam e executam outra coisa (`curl … | sh`),
- se o pacote parece bem mantido (datas, comentários em aur.archlinux.org).

### Compilando e instalando

```sh
makepkg -si
```

O `makepkg` lê o `PKGBUILD`, baixa o código-fonte, compila e empacota um
arquivo `.pkg.tar.zst`. `-s` instala as dependências que faltam e `-i`
instala o pacote com o pacman quando termina. **Não** execute o makepkg com
sudo – ele se recusa a rodar como root e usa o sudo sozinho quando
necessário.

```sh
ls
moonphase
```

### Pacotes “estrangeiros”

O pacman não sabe nada sobre o AUR. Pacotes que não vêm dos repositórios são
chamados de *foreign* (estrangeiros) e são listados com:

```sh
pacman -Qm
```

Isso também significa que o `sudo pacman -Syu` **não** atualiza pacotes do
AUR. Você precisa baixar a receita nova você mesmo (`git pull`) e compilar de
novo – ou deixar um AUR helper fazer isso.

```quiz
Você instalou o `moonphase` a partir do AUR e executa `sudo pacman -Syu`. O
`moonphase` é atualizado?
- [ ] Sim – o pacman atualiza todos os pacotes instalados
- [x] Não – o pacman não sabe nada sobre o AUR
---
Baixe a receita nova com `git pull` e compile de novo, ou use um AUR helper.
```

### O AUR helper yay

Um AUR helper faz tudo isso por você: pesquisa, baixa, mostra o `PKGBUILD`,
compila e instala. O mais comum é o **yay** (outro é o *paru*). O próprio yay
só existe no AUR, então ele é instalado na mão uma vez. O pacote `yay-bin` já
vem compilado e é o mais rápido:

```sh
cd ~
git clone https://aur.archlinux.org/yay-bin.git
cd yay-bin
makepkg -si
```

Depois disso o yay é usado mais ou menos como o pacman – mas sem sudo:

```sh
yay -Ss snowfall
yay -S snowfall
snowfall
yay -Syu
```

`yay -Syu` (ou só `yay`) atualiza tanto os pacotes dos repositórios quanto os
seus pacotes do AUR. Comodidade não significa que você pode parar de ler as
receitas!

Não há repositório para remover no AUR – cada pacote é a sua própria receita.
Limpe o que você não usa mais.
