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

Em `{{documents}}` há um terceiro arquivo de exercício, um arquivo CSV com as
pontuações dos alunos em diferentes disciplinas:

```sh
cat ~/{{documents}}/{{grades}}
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
não fazem parte de `a-z`. Vale a pena saber disso –
o GNU `awk` (mais abaixo) lida melhor com elas.

O `tr` lê **apenas** do stdin, nunca de arquivos. Se quiser usar um arquivo,
alimente-o com `<` ou com um pipe:

```sh
tr a-z A-Z < ~/{{documents}}/{{fruits}}
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

```predict
$ echo "hello world" | tr -d o
hell wrld
---
O `-d` apaga cada `o`, onde quer que ele esteja.
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
sed 's/ERROR/{{errorWord}}/' ~/{{documents}}/server.log
```

O script `s/ERROR/{{errorWord}}/` significa: substitua `ERROR` por
`{{errorWord}}`. Ele tem a forma

```text
s/PADRÃO/SUBSTITUIÇÃO/FLAGS
```

Sem flags, apenas a **primeira** ocorrência em cada linha é substituída. Com
`g` (*global*), todas são:

```sh
echo "cat cat cat" | sed 's/cat/dog/'
echo "cat cat cat" | sed 's/cat/dog/g'
```

```predict
$ echo banana | sed 's/a/o/'
bonana
---
Sem o `g`, só o primeiro `a` da linha é substituído.
```

A flag `i` faz a busca ignorar maiúsculas e minúsculas, assim como o
`grep -i`:

```sh
sed 's/warn/WARNING/i' ~/{{documents}}/server.log
```

O padrão é uma *expressão regular*, como no `grep`. Aqui removemos a data no
início de cada linha (`^` = início da linha, `[0-9-]*` = dígitos e hifens):

```sh
sed 's/^[0-9-]* //' ~/{{documents}}/server.log
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
sed -E 's|^([0-9]+)-([0-9]+)-([0-9]+)|\3/\2/\1|' ~/{{documents}}/server.log
```

### Escolhendo linhas – endereços

Antes de um comando você pode escrever um *endereço*, que escolhe a quais
linhas ele se aplica. O comando `d` (*delete*) apaga linhas e o `p` (*print*)
as imprime:

```sh
sed '/INFO/d' ~/{{documents}}/server.log
sed '1d' ~/{{documents}}/{{grades}}
```

O primeiro apaga todas as linhas que contêm `INFO`; o segundo apaga a linha 1
– o cabeçalho.

O `sed` normalmente imprime *todas* as linhas. Com `-n` ele deixa de fazer
isso, e então só é impresso o que o `p` pedir. Veja como mostrar as linhas
5 a 8:

```sh
sed -n '5,8p' ~/{{documents}}/server.log
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
sed '/ERROR/s/^/>>> /' ~/{{documents}}/server.log
```

O comando `q` (*quit*) para depois de uma determinada linha – então `sed 3q`
faz o mesmo que `head -n 3`. Você separa vários comandos com `;` ou com vários
`-e`:

```sh
sed -e '/INFO/d' -e 's/ERROR/{{errorWord}}/' ~/{{documents}}/server.log
```

### Editando o próprio arquivo – `sed -i`

Até agora tudo foi apenas *impresso*. O arquivo em si continua igual – pode
conferir com `cat`. Com `-i` (*in-place*), o `sed` grava o resultado de volta
no arquivo. Experimente em uma cópia:

```sh
cp ~/{{documents}}/{{fruits}} ~/frutas-copia.txt
sed -i 's/kiwi/kiwifruit/' ~/frutas-copia.txt
cat ~/frutas-copia.txt
```

Não existe desfazer para o `sed -i`. Uma boa forma de trabalhar é executar o
comando **sem** `-i` primeiro e olhar o resultado; depois, acrescente o `-i`
quando estiver tudo certo. Se você escrever `-i.bak`, o original também é
salvo como `arquivo.bak`.

```quiz
Você executa `sed 's/kiwi/KIWI/' ~/{{documents}}/{{fruits}}`. O que acontece com o arquivo?
- [ ] Todo `kiwi` do arquivo vira `KIWI`
- [ ] Só o primeiro `kiwi` do arquivo vira `KIWI`
- [x] Nada – o resultado só é impresso, o arquivo continua igual
---
Sem `-i`, o `sed` só escreve no stdout. O arquivo fica como estava.
```

Os arquivos de configuração em `/etc` pertencem ao root, então ali você
precisa de `sudo sed -i ...`. É uma forma comum de alterar uma configuração a
partir de um script, sem abrir um editor de texto.

## Recortando campos – `cut`

Quando um arquivo é formado por campos com um separador entre eles, o `cut`
consegue pegar um campo. O `-d` escolhe o separador (*delimiter*) e o `-f`,
qual campo manter. Aqui estão as matérias – o campo 2 – do arquivo CSV:

```sh
cut -d, -f2 ~/{{documents}}/{{grades}}
```

No `/etc/passwd`, os campos são separados por dois-pontos e o campo 1 é o nome
de usuário, então `cut -d: -f1 /etc/passwd` lista todos os usuários. Como os
outros filtros, o `cut` se encaixa em um pipe – por exemplo, antes do `tr`.

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
awk '{print $3}' ~/{{documents}}/server.log
```

O programa fica entre `{ }` e é executado para cada linha. Sempre coloque o
programa do awk entre aspas **simples** – caso contrário, o shell acha que
`$3` é uma variável do shell e a substitui antes mesmo de o awk começar.

O awk se encaixa perfeitamente em um pipe. Quantas linhas há de cada nível?

```sh
awk '{print $3}' ~/{{documents}}/server.log | sort | uniq -c
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

Compare com o `cut -d: -f1` da seção anterior. A diferença é que o awk
consegue reordenar os campos, misturar texto e lidar com vários espaços
seguidos.

```predict
$ echo "Alva,matemática,87" | awk -F, '{print $3, $1}'
87 Alva
---
O `-F,` divide a linha nas vírgulas. O awk imprime primeiro o campo 3, depois o
campo 1, com um espaço entre eles por causa da vírgula no `print`.
```

### Padrões – escolhendo linhas

Antes das `{ }` você pode escrever um *padrão*. O programa então só é
executado para as linhas que correspondem. O padrão pode ser uma expressão
regular, como no `grep`:

```sh
awk '/ERROR/ {print $2}' ~/{{documents}}/server.log
```

… ou uma condição. Texto vai entre aspas duplas:

```sh
awk -F, '$2 == "matemática" {print $1, $3}' ~/{{documents}}/{{grades}}
```

As comparações são escritas `==`, `!=`,
`<`, `<=`, `>` e `>=`, e as condições são combinadas com `&&` (e), `||` (ou)
e `!` (não). Aqui estão todos os alunos com pelo menos 90 pontos (sem `{ }`, a
linha inteira é impressa):

```sh
awk -F, '$3 >= 90' ~/{{documents}}/{{grades}}
```

A linha de cabeçalho apareceu também? Nela, o campo 3 é a palavra `pontos`, e
quando um valor não é um número, o awk o compara como *texto* – e `"pontos"`
vem depois de `"90"` na ordem alfabética. Você pula o cabeçalho com `NR > 1`:

```sh
awk -F, 'NR > 1 && $3 >= 90' ~/{{documents}}/{{grades}}
```

Experimente um padrão seu – os nomes de todos que estudam
*português*:

```try
awk -F, '$2 == "português" {print $1}' ~/{{documents}}/{{grades}}
```

### Contando – variáveis e `END`

O awk tem variáveis que você não precisa declarar – elas começam em 0. O bloco
`END { }` é executado uma vez, **depois** da última linha. Juntos, eles dão um
jeito fácil de somar uma coluna:

```sh
awk -F, 'NR > 1 {soma += $3} END {print soma}' ~/{{documents}}/{{grades}}
```

`soma += $3` significa "some o campo 3 a `soma`". Se você contar as linhas ao
mesmo tempo (`contagem++` aumenta `contagem` em 1), pode calcular a média:

```sh
awk -F, 'NR > 1 {soma += $3; contagem++} END {print "Média:", soma / contagem}' ~/{{documents}}/{{grades}}
```

Também existe o `BEGIN { }`, que é executado **antes** da primeira linha – útil
para cabeçalhos. E com o `printf` você decide exatamente como fica a saída:
`%-8s` é texto alinhado à esquerda em 8 caracteres e `%5d`, um número inteiro
em 5 caracteres.

```sh
awk -F, 'BEGIN {print "Aluno     Nota"} NR > 1 {printf "%-8s %5d\n", $1, $3}' ~/{{documents}}/{{grades}}
```

O awk também tem funções, como `length()`, `toupper()` e `tolower()`:

```sh
awk '{print toupper($0)}' ~/{{documents}}/{{fruits}}
```

Olhe com atenção para `{{fruitWord}}`. No Ubuntu, que é o que o terminal
aqui executa, o `awk` é por padrão o **mawk**, uma variante pequena e rápida.
Em programas simples como estes você não vai notar diferença nenhuma – mas o
mawk não converte letras como ç e ã com `toupper()`. O **GNU awk** (o pacote `gawk`)
converte, ao contrário do `tr`. As distribuições diferem em qual awk usam e em
como você instala programas – isso vem no capítulo sobre distribuições.

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
grep -v INFO ~/{{documents}}/server.log | awk '{print $3}' | tr A-Z a-z | sort | uniq -c
```
