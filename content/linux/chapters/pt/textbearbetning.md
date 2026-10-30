# Processamento de texto com sed, tr e awk

Com o `grep` você consegue *encontrar* linhas. Mas muitas vezes você quer ir
além: substituir uma palavra, apagar certas linhas, extrair uma coluna ou
somar alguns números. É aí que entram três ferramentas clássicas:

| Ferramenta | Trabalha com | Uso típico |
|---|---|---|
| `tr` | **caracteres** individuais | converter para maiúsculas, transformar `:` em quebras de linha |
| `sed` | **linhas** | substituir uma palavra, apagar linhas |
| `awk` | **colunas** (campos) | extrair colunas, somar, contar |

As três são *filtros*: leem texto, fazem algo com ele e escrevem o resultado
no stdout. Isso faz delas a combinação perfeita para pipes. E o arquivo
original **não** é alterado (com uma exceção, o `sed -i`, que veremos mais
adiante).

Em `dokument` há um novo arquivo de exercício, um arquivo CSV com as
pontuações dos alunos (*namn* = nome, *ämne* = matéria, *poäng* = pontos):

```sh
cat ~/dokument/betyg.csv
```

CSV significa *comma-separated values* (valores separados por vírgula) – as
colunas são separadas por vírgulas, e a primeira linha é um cabeçalho.

## Traduzindo caracteres – `tr`

O `tr` (*translate*) substitui cada caractere do primeiro conjunto pelo
caractere na mesma posição do segundo. `a-z` significa todas as letras de a
até z:

```sh
echo "hello from café" | tr a-z A-Z
```

```text
HELLO FROM CAFé
```

Percebeu o é? O `tr` trabalha com *bytes* individuais, e letras como é, ç e ã
– ou as suecas å, ä e ö – não fazem parte de `a-z`. Vale a pena saber disso –
o `awk` (mais abaixo) lida melhor com elas.

O `tr` lê **apenas** do stdin, nunca de arquivos. Se quiser usar um arquivo,
alimente-o com `<` ou com um pipe:

```sh
tr a-z A-Z < ~/dokument/frukter.txt
```

Um truque clássico é transformar dois-pontos em quebras de linha (`\n`), para
que cada diretório do `PATH` fique em uma linha própria:

```sh
echo $PATH | tr ':' '\n'
```

Com `-d` (*delete*) você remove caracteres, e com `-s` (*squeeze*) você
comprime vários caracteres iguais seguidos em um só:

```sh
echo "070-123 45 67" | tr -d ' -'
echo "espaços     demais     aqui" | tr -s ' '
```

Em vez de intervalos, você pode escrever *classes*, por exemplo `[:upper:]`
(maiúsculas), `[:lower:]` (minúsculas), `[:digit:]` (dígitos) e `[:space:]`
(espaços em branco):

```sh
echo "Sala 101, andar 3" | tr -d '[:digit:]'
```

## O editor de fluxo – `sed`

O `sed` (*stream editor*) lê o texto linha por linha e executa um pequeno
*script* em cada uma. O comando mais comum é o `s` – *substitute*.

### Substituindo texto – `s`

```sh
sed 's/ERROR/FEL/' ~/dokument/server.log
```

O script `s/ERROR/FEL/` significa: substitua `ERROR` por `FEL` ("erro" em
sueco). Ele tem a forma

```text
s/PADRÃO/SUBSTITUIÇÃO/FLAGS
```

Sem flags, apenas a **primeira** ocorrência em cada linha é substituída. Com
`g` (*global*), todas são:

```sh
echo "cat cat cat" | sed 's/cat/dog/'
echo "cat cat cat" | sed 's/cat/dog/g'
```

A flag `i` faz a busca ignorar maiúsculas e minúsculas, assim como o
`grep -i`:

```sh
sed 's/warn/WARNING/i' ~/dokument/server.log
```

O padrão é uma *expressão regular*, como no `grep`. Aqui removemos a data no
início de cada linha (`^` = início da linha, `[0-9-]*` = dígitos e hifens):

```sh
sed 's/^[0-9-]* //' ~/dokument/server.log
```

Na substituição, `&` significa "o trecho que correspondeu":

```sh
echo "Linux é divertido" | sed 's/Linux/**&**/'
```

**Outro delimitador.** Se o próprio texto tiver barras, a coisa fica confusa:
`s/\/usr\/local/\/opt/`. Mas é o caractere logo depois do `s` que define o
delimitador, então você pode muito bem usar `|` ou `#`:

```sh
echo /usr/local/bin | sed 's|/usr/local|/opt|'
```

**Grupos.** Com `-E` (expressões regulares estendidas) você pode capturar
partes da correspondência com parênteses e usá-las na substituição como `\1`,
`\2` … Aqui invertemos a data:

```sh
sed -E 's|^([0-9]+)-([0-9]+)-([0-9]+)|\3/\2/\1|' ~/dokument/server.log
```

### Escolhendo linhas – endereços

Antes de um comando você pode escrever um *endereço*, que escolhe a quais
linhas ele se aplica. O comando `d` (*delete*) apaga linhas e o `p` (*print*)
as imprime:

```sh
sed '/INFO/d' ~/dokument/server.log
sed '1d' ~/dokument/betyg.csv
```

O primeiro apaga todas as linhas que contêm `INFO`; o segundo apaga a linha 1
– o cabeçalho.

O `sed` normalmente imprime *todas* as linhas. Com `-n` ele deixa de fazer
isso, e então só é impresso o que o `p` pedir. Veja como mostrar as linhas
5 a 8:

```sh
sed -n '5,8p' ~/dokument/server.log
```

| Endereço | Significa |
|---|---|
| `5` | a linha 5 |
| `$` | a última linha |
| `/ERROR/` | as linhas que correspondem ao padrão |
| `2,4` | as linhas 2 a 4 |
| `/WARN/,/ERROR/` | de uma linha com WARN até a próxima linha com ERROR |
| `/INFO/!` | todas as linhas **exceto** as que correspondem |

Os endereços funcionam com todos os comandos, inclusive o `s`. Aqui só as
linhas de erro são marcadas:

```sh
sed '/ERROR/s/^/>>> /' ~/dokument/server.log
```

O comando `q` (*quit*) para depois de uma determinada linha – então `sed 3q`
faz o mesmo que `head -n 3`. Você separa vários comandos com `;` ou com vários
`-e`:

```sh
sed -e '/INFO/d' -e 's/ERROR/FEL/' ~/dokument/server.log
```

### Editando o próprio arquivo – `sed -i`

Até agora tudo foi apenas *impresso*. O arquivo em si continua igual – pode
conferir com `cat`. Com `-i` (*in-place*), o `sed` grava o resultado de volta
no arquivo. Experimente em uma cópia:

```sh
cp ~/dokument/frukter.txt ~/frukter-kopia.txt
sed -i 's/kiwi/kiwifruit/' ~/frukter-kopia.txt
cat ~/frukter-kopia.txt
```

Não existe desfazer para o `sed -i`. Uma boa forma de trabalhar é executar o
comando **sem** `-i` primeiro e olhar o resultado; depois, acrescente o `-i`
quando estiver tudo certo. Se você escrever `-i.bak`, o original também é
salvo como `arquivo.bak`.

Os arquivos de configuração em `/etc` pertencem ao root, então ali você
precisa de `sudo sed -i ...`. É uma forma comum de alterar uma configuração a
partir de um script, sem abrir um editor de texto.

## Colunas – `awk`

O `awk` é, na verdade, uma pequena linguagem de programação completa, mas na
maioria das vezes é usado para uma coisa só: trabalhar com **colunas**. O awk
divide cada linha em *campos*:

| Campo | Significa |
|---|---|
| `$1`, `$2` … | o primeiro, o segundo … campo |
| `$0` | a linha inteira |
| `NF` | o número de campos na linha (*number of fields*) |
| `$NF` | o último campo |
| `NR` | o número da linha (*number of record*) |

Por padrão, os campos são separados por espaços (em qualquer quantidade). No
`server.log`, o campo 3 é o nível do log:

```sh
awk '{print $3}' ~/dokument/server.log
```

O programa fica entre `{ }` e é executado para cada linha. Sempre coloque o
programa do awk entre aspas **simples** – caso contrário, o shell acha que
`$3` é uma variável do shell e a substitui antes mesmo de o awk começar.

O awk se encaixa perfeitamente em um pipe. Quantas linhas há de cada nível?

```sh
awk '{print $3}' ~/dokument/server.log | sort | uniq -c
```

### Outros separadores – `-F`

Com `-F` você escolhe o separador de campos. No `/etc/passwd` é o
dois-pontos; o campo 1 é o nome de usuário e o campo 7, o shell:

```sh
awk -F: '{print $1, $7}' /etc/passwd
```

A vírgula no `print` vira um espaço na saída. Sem vírgula, os campos ficam
grudados, e aí você pode misturar texto seu:

```sh
awk -F: '{print $1 " usa " $7}' /etc/passwd
```

Talvez você se lembre do `cut -d: -f1`. A diferença é que o awk consegue
reordenar os campos, misturar texto e lidar com vários espaços seguidos.

### Padrões – escolhendo linhas

Antes das `{ }` você pode escrever um *padrão*. O programa então só é
executado para as linhas que correspondem. O padrão pode ser uma expressão
regular, como no `grep`:

```sh
awk '/ERROR/ {print $2}' ~/dokument/server.log
```

… ou uma condição. Texto vai entre aspas duplas:

```sh
awk -F, '$2 == "matte" {print $1, $3}' ~/dokument/betyg.csv
```

(*Matte* é "matemática" em sueco.) As comparações são escritas `==`, `!=`,
`<`, `<=`, `>` e `>=`, e as condições são combinadas com `&&` (e), `||` (ou)
e `!` (não). Aqui estão todos os alunos com pelo menos 90 pontos (sem `{ }`, a
linha inteira é impressa):

```sh
awk -F, '$3 >= 90' ~/dokument/betyg.csv
```

A linha de cabeçalho apareceu também? Nela, o campo 3 é a palavra `poäng`, e
quando um valor não é um número, o awk o compara como *texto* – e `"poäng"`
vem depois de `"90"` na ordem alfabética. Você pula o cabeçalho com `NR > 1`:

```sh
awk -F, 'NR > 1 && $3 >= 90' ~/dokument/betyg.csv
```

### Contando – variáveis e `END`

O awk tem variáveis que você não precisa declarar – elas começam em 0. O bloco
`END { }` é executado uma vez, **depois** da última linha. Juntos, eles dão um
jeito fácil de somar uma coluna:

```sh
awk -F, 'NR > 1 {summa += $3} END {print summa}' ~/dokument/betyg.csv
```

`summa += $3` significa "some o campo 3 a summa" (*summa* é "soma" em sueco).
Se você contar as linhas ao mesmo tempo (`antal++` aumenta *antal*, a
contagem, em 1), pode calcular a média:

```sh
awk -F, 'NR > 1 {summa += $3; antal++} END {print "Média:", summa / antal}' ~/dokument/betyg.csv
```

Também existe o `BEGIN { }`, que é executado **antes** da primeira linha – útil
para cabeçalhos. E com o `printf` você decide exatamente como fica a saída:
`%-8s` é texto alinhado à esquerda em 8 caracteres e `%5d`, um número inteiro
em 5 caracteres.

```sh
awk -F, 'BEGIN {print "Aluno     Nota"} NR > 1 {printf "%-8s %5d\n", $1, $3}' ~/dokument/betyg.csv
```

O awk também tem funções, como `length()`, `toupper()` e `tolower()`. Ao
contrário do `tr`, o GNU awk lida com letras como å, ä e ö:

```sh
awk '{print toupper($0)}' ~/dokument/frukter.txt
```

:::debian
No {{distro}}, o `awk` é por padrão o **mawk**, uma variante pequena e rápida.
Se quiser o GNU awk, instale o pacote `gawk`. Em programas simples como estes
você não vai notar diferença nenhuma – mas o mawk não converte å, ä e ö com
`toupper()`.
:::

:::arch
No Arch Linux, o `awk` é o **GNU awk** (o pacote `gawk`).
:::

:::redhat
No {{distro}}, o `awk` é o **GNU awk** (o pacote `gawk`).
:::

O simulador conhece só uma parte da linguagem awk – o que foi visto aqui e um
pouco mais (`if`, laços e arrays). Veja `man awk`.

## Qual ferramenta devo escolher?

| Você quer … | Use |
|---|---|
| encontrar linhas que contêm algo | `grep` |
| substituir ou apagar caracteres individuais | `tr` |
| substituir palavras ou padrões, apagar linhas | `sed` |
| extrair colunas, comparar números, somar | `awk` |

O verdadeiro poder vem de combiná-las. Quais níveis existem entre as linhas
que *não* são INFO – se ignorarmos maiúsculas e minúsculas?

```sh
grep -v INFO ~/dokument/server.log | awk '{print $3}' | tr A-Z a-z | sort | uniq -c
```
