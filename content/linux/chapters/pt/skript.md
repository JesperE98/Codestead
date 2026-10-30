# Scripts de shell

Tudo o que você digitou no terminal até agora também pode ser salvo em um
arquivo e executado de novo quantas vezes quiser. Um arquivo assim se chama
**script**. Com scripts você automatiza as tarefas chatas: backups, renomear
cem arquivos ou verificar os logs toda manhã. Além disso, o bash é uma
linguagem de programação de verdade, com variáveis, condições, laços e
funções.

## Um primeiro script

Um script é um arquivo de texto comum. Em computadores de verdade, você o
escreveria em um editor de texto como o `nano` ou o `vim`. Outro jeito, que
funciona tanto aqui quanto em servidores, é um **here document**: tudo o que
estiver entre `<< 'SLUT'` e a linha `SLUT` é passado para o comando. (*Slut* é
simplesmente "fim" em sueco – você pode escolher a palavra que quiser; `EOF` é
uma escolha comum.)

Digite a primeira linha e pressione Enter. O prompt muda para `> ` – o shell
está esperando o resto. Digite as linhas uma por vez e termine com `SLUT`:

```sh
cat > hej.sh << 'SLUT'
#!/bin/bash
echo "Olá de um script!"
echo "Hoje é $(date)"
SLUT
```

A primeira linha, `#!/bin/bash`, se chama *shebang* e diz ao sistema qual
programa deve executar o arquivo. Torne o script executável e execute-o:

```sh
chmod +x hej.sh
./hej.sh
```

As linhas que começam com `#` (fora a linha do shebang) são **comentários**,
que o shell ignora. Use-os para explicar o que o código faz!

## Variáveis

Você cria uma variável com `nome=valor`. **Não** pode haver espaços em volta
do sinal de igual – senão o shell acha que `nome` é um comando.

```sh
stad=Göteborg
echo "Eu moro em $stad"
```

(*Stad* significa "cidade".) Sempre coloque as variáveis entre **aspas
duplas** quando for usá-las. Sem aspas, o valor é dividido nos espaços, o que
causa erros estranhos quando um nome de arquivo tem espaço. Se quiser escrever
texto logo depois do nome da variável, use chaves: `"${stad}_2026"` – sem
elas, o bash procuraria uma variável chamada `stad_2026`.

```quiz
`stad` contém `Göteborg`, e não existe nenhuma variável chamada `stad_2026`. O
que `echo "$stad_2026"` imprime?
- [ ] `Göteborg_2026`
- [ ] `Göteborg`
- [x] Uma linha vazia
---
O bash lê o nome inteiro `stad_2026`, e essa variável não existe.
Escreva `"${stad}_2026"` para obter `Göteborg_2026`.
```

## Substituição de comandos – `$(...)`

`$(comando)` é substituído pelo que o comando imprime. É assim que você
guarda o resultado de um comando em uma variável:

```sh
idag=$(date)
filer=$(ls ~ | wc -l)
echo "Há $filer itens no seu diretório pessoal"
```

## Aritmética – `$(( ))`

O bash faz contas com números inteiros dentro de `$(( ))`. Dentro dos
parênteses você não precisa de `$` na frente das variáveis:

```sh
a=7
echo $(( a * 6 ))
echo $(( 17 / 5 )) remainder $(( 17 % 5 ))
```

(*Remainder* é "resto" em inglês.) Para alterar uma variável, escreva
`(( a++ ))` ou `(( a += 10 ))`.

```predict
$ echo $(( 7 / 2 )) $(( 7 % 2 ))
3 1
---
O bash só calcula com números inteiros: 7 / 2 dá 3, e o resto (`%`) é 1.
```

## Argumentos

Quando você executa `./skript.sh um dois`, o script consegue ler os
argumentos:

| Variável | Contém |
|---|---|
| `$0` | O nome do script |
| `$1`, `$2` ... | O primeiro, o segundo ... argumento |
| `$#` | O número de argumentos |
| `"$@"` | Todos os argumentos, cada um separadamente |
| `$?` | O código de saída do comando anterior |

```quiz
Um script é executado com `./skript.sh red green blue`. O que `$1` e `$#`
contêm?
- [ ] `$1` é `./skript.sh` e `$#` é `4`
- [x] `$1` é `red` e `$#` é `3`
- [ ] `$1` é `red` e `$#` é `blue`
---
O nome do próprio script fica em `$0`, então ele não é contado em `$#`.
```

## Condições – `if`

O `if` executa um comando e olha o **código de saída** dele: 0 significa
verdadeiro, qualquer outro valor, falso. Na maioria das vezes se usa o comando
`[` (também conhecido como `test`):

```sh
if [ -f ~/.bashrc ]; then echo "O arquivo existe"; else echo "O arquivo não existe"; fi
```

Os espaços dentro de `[ ]` são obrigatórios! Escrito em várias linhas, como em
um script, fica assim:

```text
if [ "$resposta" = "sim" ]; then
    echo "Ótimo!"
elif [ "$resposta" = "não" ]; then
    echo "Que pena."
else
    echo "Responda sim ou não."
fi
```

Os testes mais comuns:

| Teste | Verdadeiro se |
|---|---|
| `-f ARQUIVO` | o arquivo existe (e é um arquivo comum) |
| `-d DIR` | o diretório existe |
| `-z "$x"` | a variável está vazia |
| `"$a" = "$b"` | as strings são iguais (`!=` diferentes) |
| `$a -eq $b` | os números são iguais |
| `$a -lt $b` | menor que (`-le`, `-gt`, `-ge`, `-ne`) |
| `! CONDIÇÃO` | a condição *não* é verdadeira |

Repare que números são comparados com `-eq`, `-lt` e assim por diante,
enquanto `=` e `<` comparam texto. O bash também tem o `[[ ... ]]`, que é um
pouco mais esperto: nele você pode escrever `&&` e `||` e comparar com padrões
como `[[ $file == *.txt ]]`.

Para condições curtas, muitas vezes o `&&` e o `||` bastam:

```sh
[ -d ~/bilder ] && echo "O diretório de imagens existe"
```

```predict
$ x=""
$ if [ -z "$x" ]; then echo empty; else echo "not empty"; fi
empty
```

## Laços

Um **laço for** faz a mesma coisa para cada item de uma lista:

```sh
for frukt in äpple banan kiwi; do echo "Eu gosto de $frukt"; done
```

A lista pode vir de curingas ou de um comando:

```sh
for fil in ~/dokument/*; do echo "Arquivo: $fil"; done
for i in $(seq 1 3); do echo "Rodada $i"; done
```

Um **laço while** continua enquanto a condição for verdadeira:

```sh
i=1; while [ $i -le 3 ]; do echo $i; (( i++ )); done
```

O jeito mais comum de percorrer um arquivo linha por linha é o `while read`,
com o arquivo alimentado por um `<` depois do `done`:

```sh
while read rad; do echo "> $rad"; done < ~/dokument/frukter.txt
```

O `break` sai de um laço, e o `continue` pula direto para a próxima rodada.

```predict
$ for x in 2 4 6; do echo $(( x * 10 )); done
20
40
60
```

> **Cuidado com laços infinitos!** Um laço cuja condição nunca fica falsa
> continua para sempre. Em um terminal de verdade, você o interrompe com
> **Ctrl+C**. O simulador o interrompe sozinho depois de 20.000 passos.

## Escolhendo com `case`

Quando uma variável pode ter muitos valores diferentes, o `case` é mais claro
do que uma longa cadeia de `elif`:

```sh
fil=semester.jpg
case $fil in *.jpg|*.png) echo "Uma imagem";; *.txt) echo "Um arquivo de texto";; *) echo "Tipo desconhecido";; esac
```

Cada alternativa termina com `;;`, e `*)` pega todo o resto.

## Funções

Uma **função** é um trecho de código com nome que você pode chamar como se
fosse um comando. Ela recebe argumentos do mesmo jeito que um script – `$1`,
`$2` e `$#`:

```sh
halsa() { echo "Olá, $1, seja bem-vindo!"; }
halsa Kim
```

As variáveis que só devem existir dentro da função são criadas com `local`, e
o `return` encerra a função com um código de saída.

## Perguntando ao usuário – `read`

O `read` lê uma linha do teclado para uma variável:

```sh
read -p "Qual é o seu nome? " namn; echo "Olá, $namn!"
```

## Um exemplo completo

Aqui está um script que usa quase tudo o que este capítulo mostrou. Ele faz
backup dos arquivos que você passa como argumentos:

```text
#!/bin/bash
# backup.sh – copia cada arquivo para arquivo.bak

if [ $# -eq 0 ]; then
    echo "Uso: $0 ARQUIVO..."
    exit 1
fi

for arquivo in "$@"; do
    if [ -f "$arquivo" ]; then
        cp "$arquivo" "$arquivo.bak"
        echo "Copiado: $arquivo"
    else
        echo "Não encontrei $arquivo" >&2
    fi
done
```

O `exit 1` encerra o script com o código de saída 1, para que quem chamou o
script veja que algo deu errado.

## Dicas para bons scripts

- Comece com `#!/bin/bash` e escreva comentários.
- Coloque as variáveis entre aspas: `"$arquivo"`, e não `$arquivo`.
- Muita gente começa os scripts com `set -euo pipefail`, para que o script
  pare no primeiro erro em vez de seguir adiante às cegas.
- O programa **ShellCheck** encontra erros comuns em scripts bash – você pode
  instalá-lo com o gerenciador de pacotes em todas as grandes distribuições.
