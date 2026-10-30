# Discos e sistemas de arquivos

Para onde vão, de fato, os arquivos que você salva? No Windows a resposta é
uma letra – `C:`, `D:`, `E:`. O Linux não tem letras de unidade, só **uma**
árvore de diretórios que começa em `/`. Neste capítulo você vai olhar por
baixo do capô: quais discos o computador tem, como eles estão divididos,
quanto espaço sobra – e como conectar um pendrive e removê-lo de novo sem
perder nada.

## Disco, partição e sistema de arquivos

Três palavras que muitas vezes se confundem, mas significam coisas
diferentes:

- Um **disco** é o próprio dispositivo de armazenamento: um SSD, um HD, um
  cartão SD ou um pendrive.
- Uma **partição** é um pedaço do disco. Um disco pode ser dividido em várias
  partições usadas para coisas diferentes. Onde cada partição começa e
  termina fica guardado na **tabela de partições** do disco – em computadores
  novos do tipo **GPT**; em computadores mais antigos e na maioria dos
  pendrives, o velho **MBR** (que as ferramentas chamam de `dos`).
- Um **sistema de arquivos** é a organização *dentro* de uma partição: como
  nomes de arquivos, diretórios, permissões e o próprio conteúdo são
  guardados. Uma partição nova está vazia e inutilizável até você criar um
  sistema de arquivos nela – é isso que **formatar** significa.

Pense no disco como um galpão vazio, nas partições como as paredes que o
dividem em salas e no sistema de arquivos como as prateleiras e etiquetas de
cada sala. Sem prateleiras você não encontra nada.

```quiz
Você acabou de criar uma partição nova em um disco. Por que ainda não dá para
salvar arquivos nela?
- [ ] Ela precisa primeiro ser adicionada à tabela de partições
- [x] Ela ainda não tem sistema de arquivos – precisa ser formatada primeiro
- [ ] Partições não guardam arquivos, só discos guardam
- [ ] Ela precisa primeiro ganhar uma letra de unidade
---
Uma partição nova fica vazia e inutilizável até você criar um sistema de
arquivos nela. É isso que formatar significa.
```

## Discos são arquivos em `/dev`

No Linux quase tudo é um arquivo – inclusive os discos. Todo disco e toda
partição têm um **arquivo de dispositivo** em `/dev`:

```sh
ls -l /dev/sd*
```

| Arquivo de dispositivo | É |
|---|---|
| `/dev/sda` | O primeiro disco (SATA, USB ou um disco virtual) |
| `/dev/sda1`, `/dev/sda2` | As partições 1 e 2 do `sda` |
| `/dev/sdb` | O segundo disco – o pendrive deste computador |
| `/dev/nvme0n1`, `/dev/nvme0n1p1` | Um SSD NVMe e a primeira partição dele |
| `/dev/vda` | Um disco em uma máquina virtual |
| `/dev/mmcblk0p1` | A primeira partição de um cartão SD (por exemplo, em um Raspberry Pi) |

As letras são distribuídas na ordem em que os discos são encontrados. Se o
computador tem um SSD NVMe, um pendrive pode muito bem virar `sda` – então
**nunca chute**, sempre confira. Os arquivos de dispositivo pertencem ao root
e ao grupo `disk`, então como usuário comum você não consegue ler os discos
diretamente.

## Quais discos existem? – `lsblk`

O `lsblk` (*list block devices*) desenha os discos como uma árvore, com as
partições embaixo de cada disco:

```sh
lsblk
```

| Coluna | Significa |
|---|---|
| `NAME` | O nome em `/dev` |
| `RM` | 1 = removível, por exemplo um pendrive |
| `SIZE` | O tamanho |
| `TYPE` | `disk` ou `part` (partição) |
| `MOUNTPOINTS` | Onde o sistema de arquivos aparece na árvore de diretórios, `[SWAP]` para swap |

Neste computador, `sda1` é a **partição EFI** (de onde o firmware do
computador dá boot) em `/boot/efi`, `sda2` é o **sistema de arquivos raiz**
`/` e `sda3` é a **swap**. Outras distribuições – e outras instalações –
podem dividir o disco de outro jeito, então sempre olhe em vez de supor.

Com `-f`, o `lsblk` também mostra os sistemas de arquivos – tipo, rótulo
(*label*), UUID e quanto está livre:

```sh
lsblk -f
```

Repare no `sdb1`: um sistema de arquivos `vfat` com o rótulo `USBMINNE`
("memória USB" em sueco) que não está montado em lugar nenhum. É o pendrive
que vamos conectar.

## Sistemas de arquivos diferentes

Existem muitos sistemas de arquivos, com pontos fortes diferentes:

| Sistema de arquivos | Usado para |
|---|---|
| `ext4` | O padrão clássico do Linux. Estável e rápido – o Debian e o Ubuntu o usam |
| `btrfs` | Snapshots, compressão e subvolumes. Padrão no Fedora e no openSUSE |
| `xfs` | Bom com arquivos grandes e servidores. Padrão no Red Hat Enterprise Linux |
| `vfat` (FAT32) | Funciona em todo lugar: Windows, macOS, câmeras, som de carro. Sem permissões do Linux e no máximo 4 GiB por arquivo. A partição EFI precisa ser FAT |
| `exfat` | Como o FAT, mas sem o limite de 4 GiB. Comum em pendrives e cartões SD novos |
| `ntfs` | O sistema de arquivos do Windows. O Linux consegue ler e escrever nele |
| `swap` | Não é um sistema de arquivos para arquivos – é "memória" extra no disco |
| `tmpfs` | Um sistema de arquivos que só existe na RAM e desaparece ao reiniciar |

## Tudo é uma árvore só – montagem

**Montar** um sistema de arquivos significa prendê-lo à árvore de diretórios
em um determinado diretório, um **ponto de montagem**. O sistema de arquivos
raiz é montado em `/`, e todo o resto é pendurado em algum lugar abaixo dele.
É por isso que o Linux se vira sem letras de unidade: outro disco é só mais
um diretório.

O `findmnt` mostra todas as montagens como uma árvore:

```sh
findmnt
```

E o `mount` sem argumentos lista a mesma coisa, uma linha por sistema de
arquivos:

```sh
mount
```

Você também vê coisas que não são discos: `proc` em `/proc` e `sysfs` em
`/sys` são informações do kernel disfarçadas de arquivos, e os `tmpfs` são
sistemas de arquivos na RAM. Pontos de montagem comuns:

| Diretório | Usado para |
|---|---|
| `/` | O sistema de arquivos raiz |
| `/boot`, `/boot/efi` | O kernel e a partição EFI |
| `/mnt` | Montagens temporárias que você faz à mão |
| `/media/elev/…` ou `/run/media/elev/…` | Onde o ambiente gráfico monta pendrives automaticamente |

## Quanto espaço sobra? – `df`

O `df` (*disk free*) mostra quão cheio está cada sistema de arquivos montado.
Com `-h` você recebe tamanhos legíveis para humanos:

```sh
df -h
```

| Coluna | Significa |
|---|---|
| `Filesystem` | Onde o sistema de arquivos fica, por exemplo uma partição ou `tmpfs` |
| `Size`, `Used`, `Avail` | Tamanho, usado e disponível |
| `Use%` | Quão cheio ele está |
| `Mounted on` | O ponto de montagem |

O `-T` acrescenta o tipo do sistema de arquivos, e se você passar um caminho,
só o sistema de arquivos em que ele está é mostrado:

```sh
df -hT
df -h ~
```

Reparou que `Used` e `Avail` não somam exatamente `Size`? O ext4 reserva 5 %
para o root, para que o sistema continue funcionando mesmo quando um usuário
comum encheu o disco.

```try
df -hT
---
A coluna `Type` mostra que `/` é `ext4` e `/boot/efi` é `vfat`.
```

## `df` ou `du`?

Dois comandos com nomes quase iguais, mas que respondem a perguntas
diferentes:

| Pergunta | Comando |
|---|---|
| Quão cheio está o **disco**? | `df -h` – pergunta ao sistema de arquivos |
| Quanto espaço estes **arquivos** ocupam? | `du -sh diretório` – percorre os arquivos e soma tudo |

Quando um disco enche, você usa os dois: primeiro `df -h` para ver *qual*
sistema de arquivos está cheio, depois `du` para descobrir *o que* está
ocupando o espaço:

```sh
du -h -d 1 ~
```

## Montando um pendrive

Agora vamos conectar o pendrive. Primeiro: qual dispositivo é ele? O
`lsblk -f` mostrou um disco removível, `sdb`, com a partição `sdb1` de rótulo
`USBMINNE`. É a **partição** que você monta, não o disco inteiro.

Depois você precisa de um ponto de montagem – um diretório comum e vazio.
Tanto criá-lo quanto montar exigem root:

```sh
sudo mkdir -p /mnt/usb
sudo mount /dev/sdb1 /mnt/usb
```

O `mount` reconhece o sistema de arquivos FAT sozinho; se quiser ser
explícito, você pode acrescentar `-t vfat`. Agora os arquivos do pendrive
aparecem no diretório:

```sh
ls -l /mnt/usb
df -h /mnt/usb
```

A partir daqui o pendrive funciona como qualquer outro diretório. Copie um
arquivo para o seu diretório pessoal:

```sh
cp /mnt/usb/att-gora.txt ~
```

> **Por que tudo pertence ao root?** O FAT não tem permissões do Linux.
> Quando um pendrive FAT é montado, *todos* os arquivos recebem, portanto, o
> mesmo dono e as mesmas permissões – o dono é quem montou, ou seja, o root.
> Para escrever no pendrive você precisa ou de `sudo`, ou de montá-lo de modo
> que você vire o dono: `sudo mount -o uid=1000,gid=1000 /dev/sdb1 /mnt/usb`
> (1000 é o seu id de usuário – veja `id`).

Você também pode montar pelo rótulo em vez do nome do dispositivo:
`sudo mount LABEL=USBMINNE /mnt/usb`. Em um computador com ambiente gráfico,
o gerenciador de arquivos faz tudo isso automaticamente quando você conecta o
pendrive.

```quiz
Depois de `sudo mount /dev/sdb1 /mnt/usb`, todos os arquivos do pendrive FAT
pertencem ao root. Por quê?
- [ ] Os arquivos foram criados pelo root em outro computador
- [x] O FAT não tem permissões do Linux, então todos os arquivos recebem como dono quem montou – o root
- [ ] Tudo em `/mnt` sempre pertence ao root
- [ ] Pendrives só podem ser usados pelo root
---
Com `-o uid=1000,gid=1000` você mesmo pode escolher o dono quando
monta.
```

## Desmontar – antes de tirar o pendrive!

O Linux nem sempre escreve no disco na hora. As alterações são juntadas na
RAM (*cache*) e escritas um pouco depois, porque isso é muito mais rápido. Se
você tirar um pendrive que ainda está montado, arquivos que você "salvou"
podem estar faltando ou corrompidos. Por isso você **desmonta** antes – com
`umount`, sem n:

```text
sudo umount /mnt/usb
```

O `umount` escreve tudo o que está pendente e depois solta o sistema de
arquivos. Quando o prompt voltar, é seguro tirar o pendrive. (O `sync`
também escreve tudo o que está pendente, mas sem desmontar.)

Se algo estiver usando o sistema de arquivos, o `umount` se recusa:

```text
$ cd /mnt/usb
$ sudo umount /mnt/usb
umount: /mnt/usb: target is busy.
```

Aqui é o seu próprio shell que está parado no diretório. Saia com `cd ~` e
tente de novo. Depois de desmontar, `/mnt/usb` volta a ser um diretório vazio
– mas os arquivos, e as alterações que você fez, continuam no pendrive na
próxima vez que você montá-lo.

```quiz
Por que você deve desmontar um pendrive antes de tirá-lo?
- [ ] Senão os arquivos do pendrive são apagados
- [x] Alterações ainda podem estar esperando na RAM – o `umount` as escreve antes de desligar o sistema de arquivos
- [ ] Senão o pendrive ganha outro nome de dispositivo na próxima vez
- [ ] O pendrive não pode ser montado de novo até ter sido desmontado no mesmo computador
---
O Linux junta as alterações na RAM (*cache*) e as escreve um pouco depois. Um
pendrive tirado enquanto ainda está montado pode perder arquivos que você
"salvou".
```

## `/etc/fstab` – o que é montado no boot

O sistema de arquivos raiz, o `/boot` e a swap são montados automaticamente
toda vez que o computador liga. O que deve ser montado está listado no
arquivo `/etc/fstab` (*file system table*):

```sh
cat /etc/fstab
```

Cada linha tem seis colunas:

| Coluna | Exemplo | Significa |
|---|---|---|
| Dispositivo | `UUID=3f1c…` | Qual sistema de arquivos |
| Ponto de montagem | `/` | Onde na árvore (`none` para swap) |
| Tipo | `ext4` | O tipo do sistema de arquivos |
| Opções | `defaults`, `errors=remount-ro` | Opções de montagem, separadas por vírgula |
| dump | `0` | Antiga flag de backup, quase sempre 0 |
| pass | `1` | A ordem em que o `fsck` os verifica no boot (1 = raiz, 2 = outros, 0 = nunca) |

A opção `errors=remount-ro` significa que o sistema de arquivos raiz passa a
ser somente leitura se for detectado um erro – melhor isso do que estragar
mais coisas. Comentários como `# / was on /dev/sda2 during installation`
foram escritos pelo instalador.

Por que `UUID=…` e não simplesmente `/dev/sda2`? Nomes de dispositivo podem
mudar – conecte um disco novo e o antigo pode ganhar outra letra. Um UUID é
criado junto com o sistema de arquivos e nunca muda. Você o encontra com
`lsblk -f`, `blkid` ou `findmnt`:

```sh
sudo blkid
findmnt -n -o UUID /
```

No `findmnt`, o `-o` escolhe as colunas a mostrar e o `-n` omite o cabeçalho –
prático quando você só quer o valor em si.

```predict
$ findmnt -n -o FSTYPE /boot/efi
vfat
---
O `/boot/efi` é a partição EFI, e a partição EFI precisa ser FAT.
```

Se você quiser que o pendrive sempre possa ser montado em `/mnt/usb`, pode
acrescentar uma linha como esta:

```text
LABEL=USBMINNE  /mnt/usb  vfat  noauto,user,uid=1000,gid=1000  0  0
```

`noauto` significa que ele não é montado no boot (o pendrive pode não estar
conectado), e `user`, que usuários comuns podem montá-lo – aí basta
`mount /mnt/usb`, sem `sudo`.

> **Aviso:** um erro no `/etc/fstab` pode impedir o computador de dar boot
> direito. Sempre teste as alterações com `sudo mount -a`, que monta tudo o
> que está no arquivo e ainda não foi montado, *antes* de reiniciar. Para
> discos externos que nem sempre estão conectados, acrescente a opção
> `nofail`.

## Swap

A **swap** é um espaço usado quando a RAM acaba: partes da memória que não
estão sendo usadas no momento são movidas para lá, para que os programas
caibam. A swap é muito mais lenta que a RAM, então um computador que usa
muita swap fica lento – mas isso é melhor do que programas travarem.

```sh
swapon --show
free -h
```

Aqui a swap é uma partição própria, a `sda3`. Muitas instalações (por
exemplo, o Ubuntu mais recente) usam um *arquivo de swap* no sistema de
arquivos raiz em vez disso.

## Particionar e formatar – com o máximo cuidado

O `fdisk -l` mostra as tabelas de partições de todos os discos, com onde cada
partição começa e termina e de que tipo ela é. Ele exige root:

```sh
sudo fdisk -l
```

Com o `fdisk` (sem `-l`), o `parted` ou o gráfico `gparted` você pode alterar
a tabela de partições, e com o `mkfs` você cria um novo sistema de arquivos –
você formata:

```text
sudo umount /mnt/usb
sudo mkfs.vfat -n USBMINNE /dev/sdb1    # FAT32 – funciona em todo lugar
sudo mkfs.ext4 -L BACKUP /dev/sdb1      # ext4 – permissões do Linux, mas só no Linux
```

> **Aviso!** `fdisk` e `mkfs` estão entre os comandos mais perigosos que
> existem. Uma letra digitada errado – `sda` em vez de `sdb` – e o disco do
> sistema inteiro se foi. Antes de formatar qualquer coisa em um computador de
> verdade: confira com `lsblk -f` que o tamanho, a coluna `RM` e o rótulo
> batem, garanta que a partição não está montada e tenha um backup de tudo o
> que é importante.

No simulador você pode experimentar `mkfs.ext4` e `mkfs.vfat` no pendrive –
mas faça as tarefas primeiro, porque os arquivos do pendrive desaparecem. As
partições do próprio sistema estão protegidas porque estão montadas,
exatamente como em um sistema de verdade.

## Resumo

| Comando | Faz |
|---|---|
| `lsblk`, `lsblk -f` | Mostra discos, partições e sistemas de arquivos |
| `blkid` | Mostra tipo, rótulo e UUID |
| `df -h` | Quão cheios estão os sistemas de arquivos? |
| `du -sh diretório` | Quanto espaço os arquivos ocupam? |
| `findmnt`, `mount` | O que está montado, e onde? |
| `sudo mount /dev/sdb1 /mnt/usb` | Monta um sistema de arquivos |
| `sudo umount /mnt/usb` | Desmonta – antes de tirar o pendrive |
| `cat /etc/fstab` | O que é montado no boot? |
| `swapon --show` | Mostra a swap |
| `sudo fdisk -l` | Mostra as tabelas de partições |
