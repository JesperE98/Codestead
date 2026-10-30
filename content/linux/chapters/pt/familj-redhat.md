# A família Red Hat: dnf e COPR

O Fedora, o Red Hat Enterprise Linux (RHEL) e clones do RHEL, como o Rocky
Linux, formam a **família Red Hat**. Elas usam o gerenciador de pacotes
**dnf** e pacotes no formato `.rpm`. Este capítulo sempre roda em uma
distribuição da família Red Hat – neste momento é o **{{distro}}**.

## O dnf em resumo

| O quê | Comando |
|---|---|
| Atualizar a lista de pacotes | `dnf check-update` |
| Atualizar tudo | `dnf upgrade` |
| Instalar | `dnf install X` |
| Remover | `dnf remove X` |
| Pesquisar | `dnf search X` |
| Informações do pacote | `dnf info X` |
| Listar instalados | `dnf list --installed` |

Os comandos que alteram o sistema exigem root, por isso são executados com
`sudo`.

## Metadados automáticos

O dnf busca sozinho as informações novas dos pacotes quando precisa, então
não existe uma etapa separada como o `apt update` da família Debian. Se
quiser ver quais atualizações estão disponíveis, execute:

```sh
dnf check-update
```

O `dnf check-update` não exige root. O código de saída é `100` se houver
atualizações – útil em scripts. No simulador há atualizações esperando. O que
isto imprime?

```predict
$ dnf check-update > /dev/null; echo $?
100
---
O `> /dev/null` esconde a lista, e o `$?` é o código de saída do último
comando: `100` significa que há atualizações.
```

## Instalando e removendo

```sh
sudo dnf install htop
```

Repare na pergunta `Is this ok [y/N]`. O `N` maiúsculo significa que **não**
é o padrão – se você só pressionar Enter, a instalação é cancelada. Digite
`y` e Enter, ou use `-y`.

```quiz
O dnf pergunta `Is this ok [y/N]` e você só pressiona Enter. O que acontece?
- [ ] O pacote é instalado
- [x] A instalação é cancelada
- [ ] O dnf pergunta de novo
---
A letra maiúscula é o padrão. Na família Debian, o apt pergunta `[Y/n]`,
então lá o Enter significa sim.
```

O `dnf remove pacote` remove um pacote de novo.

## Atualizando o sistema

```sh
sudo dnf upgrade
```

## Por baixo dos panos: rpm

Os pacotes são arquivos `.rpm` e a ferramenta de baixo nível se chama `rpm`.
O dnf substituiu o antigo `yum`, e o Fedora 41 trouxe a nova versão **dnf5**,
que é bem mais rápida. No RHEL, no Rocky e no AlmaLinux o comando também se
chama `dnf`.

## Repositórios extras – práticos, mas por sua conta e risco

Os repositórios da distribuição têm dezenas de milhares de pacotes – mas não
tudo. Um programa de nicho pode simplesmente não estar lá, ou estar só em uma
versão antiga. É para isso que existem os **repositórios extras**, onde
desenvolvedores e usuários compartilham os seus próprios pacotes.

Os pacotes dos repositórios da própria distribuição são testados em conjunto,
assinados e revisados pelos desenvolvedores da distribuição. Já um repositório
extra pode ser criado por qualquer pessoa. Tenha isso em mente antes de
adicionar um:

- **Os pacotes são instalados como root.** Um pacote pode fazer qualquer coisa
  com o computador. Você confia em quem o empacotou tanto quanto confia na
  distribuição.
- **Pode dar conflito.** Um pacote de um repositório extra pode substituir
  bibliotecas do próprio sistema ou precisar de versões diferentes das que você
  tem.
- **Ele pode deixar de ser atualizado.** Se a pessoa que mantém o repositório
  perder o interesse, você não recebe mais atualizações de segurança para o
  programa.

Uma boa regra prática: procure primeiro nos repositórios da distribuição,
depois um Flatpak (no capítulo sobre pacotes universais) e só então em um
repositório extra de alguém em quem você confia.

## COPR

O **COPR** (*Cool Other Package Repo*) é o serviço de build do Fedora.
Qualquer pessoa com uma conta no Fedora pode gerar pacotes `.rpm` lá, e cada
projeto vira um repositório próprio chamado `usuário/projeto`. Os
repositórios COPR não são revisados pela distribuição.

No restante deste capítulo você instala um programa inventado, `moonphase`
(ele mostra a fase da lua no terminal), a partir do COPR.

### Os repositórios que você tem agora

```sh
dnf repolist
```

```try
dnf repolist
---
Estes são os repositórios do próprio Fedora.
```

### Ativando um repositório COPR

```sh
sudo dnf copr enable lunatool/moonphase
```

O dnf lembra você de que o repositório não faz parte do Fedora e de que a
qualidade pode variar. O padrão da pergunta é **não**, então responda `y`. Um
arquivo novo é criado em `/etc/yum.repos.d/`:

```sh
ls /etc/yum.repos.d
dnf copr list
dnf repolist
```

```quiz
Qualquer pessoa com uma conta no Fedora pode gerar pacotes no COPR. Quem os revisa?
- [ ] Os desenvolvedores do Fedora, antes de serem publicados
- [ ] A Red Hat
- [x] Ninguém – você precisa confiar em quem mantém o repositório
```

### Instalando e executando

O dnf busca sozinho as informações do repositório novo, então o pacote pode
ser instalado na hora:

```sh
sudo dnf install moonphase
moonphase
```

### De onde vem o pacote?

```sh
dnf info moonphase
```

A linha `From repository` mostra que o pacote veio do COPR. Pacotes do COPR
são atualizados normalmente com `sudo dnf upgrade`.

### Desativando ou removendo

```sh
sudo dnf copr disable lunatool/moonphase
dnf copr list
```

O `disable` deixa o arquivo no lugar, mas desliga o repositório; o `remove`
o apaga completamente. O programa continua instalado, mas não recebe mais
atualizações.

```quiz
Qual é a diferença entre `dnf copr disable` e `dnf copr remove`?
- [x] O `disable` desliga o repositório, mas deixa o arquivo; o `remove` o apaga
- [ ] O `disable` também desinstala os pacotes; o `remove` não
- [ ] Não há diferença
```

### RPM Fusion

Outro repositório extra comum para o Fedora é o **RPM Fusion**. Ele tem
coisas que o Fedora não pode ou não quer incluir, como certos codecs de mídia
e drivers. É um projeto grande e coletivo – não o repositório de um único
usuário, como no COPR.

Cada repositório que você adiciona é mais um remetente em quem você confia.
Mantenha a lista curta e limpe o que você não usa mais.
