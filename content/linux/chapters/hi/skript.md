# Shell scripts

अब तक आपने terminal में जो कुछ भी टाइप किया है, उसे एक file में save करके बार-बार
चलाया भी जा सकता है। ऐसी file को **script** कहते हैं। Scripts से आप उबाऊ कामों को
automate कर सकते हैं: backups, सौ files के नाम बदलना या हर सुबह logs check करना। इसके
ऊपर, bash एक असली programming language है, जिसमें variables, conditions, loops और
functions हैं।

## पहली script

Script एक साधारण text file है। असली computers पर आप इसे `nano` या `vim` जैसे किसी text
editor में लिखेंगे। एक और तरीक़ा, जो यहाँ भी और servers पर भी काम करता है, है **here
document**: `<< '{{heredocEnd}}'` और line `{{heredocEnd}}` के बीच की हर चीज़ command को दे दी
जाती है। (आप कोई भी शब्द चुन सकते हैं – `EOF` भी एक आम पसंद है।)

पहली line टाइप कीजिए और Enter दबाइए। Prompt बदलकर `> ` हो जाता है – shell बाक़ी हिस्से
का इंतज़ार कर रहा है। Lines एक-एक करके टाइप कीजिए और `{{heredocEnd}}` से ख़त्म कीजिए:

```sh
cat > {{helloScript}} << '{{heredocEnd}}'
#!/bin/bash
echo "Script की ओर से नमस्ते!"
echo "आज की तारीख़: $(date)"
{{heredocEnd}}
```

पहली line, `#!/bin/bash`, को *shebang* कहते हैं और यह system को बताती है कि file किस
program से चलाई जाए। Script को executable बनाइए और चलाइए:

```sh
chmod +x {{helloScript}}
./{{helloScript}}
```

जो lines `#` से शुरू होती हैं (shebang line को छोड़कर), वे **comments** हैं, जिन्हें
shell छोड़ देता है। इनसे समझाइए कि code क्या करता है!

## Variables

Variable `name=value` से बनाया जाता है। Equals sign के आसपास कोई space **नहीं** होना
चाहिए – वरना shell `name` को एक command समझ लेता है।

```sh
city=मुंबई
echo "मैं $city में रहता हूँ"
```

Variables इस्तेमाल करते समय उन्हें हमेशा **double quotes**
के अंदर रखिए। Quotes के बिना value spaces पर टूट जाती है, जिससे किसी file name में
space होने पर अजीब errors आते हैं। अगर आप variable के नाम के ठीक बाद text लिखना चाहते
हैं, तो curly braces इस्तेमाल कीजिए: `"${city}_2026"` – इनके बिना bash `city_2026` नाम
का variable ढूँढेगा।

```quiz
`city` में `मुंबई` है, और `city_2026` नाम का कोई वेरिएबल नहीं है।
`echo "$city_2026"` क्या छापता है?
- [ ] `मुंबई_2026`
- [ ] `मुंबई`
- [x] एक ख़ाली पंक्ति
---
Bash पूरा नाम `city_2026` पढ़ता है, और वह वेरिएबल मौजूद नहीं है।
`मुंबई_2026` पाने के लिए `"${city}_2026"` लिखिए।
```

## Command substitution – `$(...)`

`$(command)` की जगह वह आ जाता है जो command print करता है। इसी तरह आप किसी command का
नतीजा एक variable में save करते हैं:

```sh
today=$(date)
count=$(ls ~ | wc -l)
echo "आपकी home directory में $count चीज़ें हैं"
```

## Arithmetic – `$(( ))`

Bash `$(( ))` के अंदर integer arithmetic करता है। Parentheses के अंदर variables के आगे
`$` की ज़रूरत नहीं होती:

```sh
a=7
echo $(( a * 6 ))
echo $(( 17 / 5 )) remainder $(( 17 % 5 ))
```

किसी variable को बदलने के लिए `(( a++ ))` या `(( a += 10 ))` लिखिए।

```predict
$ echo $(( 7 / 2 )) $(( 7 % 2 ))
3 1
---
Bash सिर्फ़ पूर्णांकों (integers) से गिनता है: 7 / 2 बराबर 3 है, और शेषफल (`%`) 1 है।
```

## Arguments

जब आप `./script.sh one two` चलाते हैं, तो script arguments पढ़ सकती है:

| Variable | क्या होता है |
|---|---|
| `$0` | Script का नाम |
| `$1`, `$2` ... | पहला, दूसरा ... argument |
| `$#` | Arguments की संख्या |
| `"$@"` | सारे arguments, हर एक अलग-अलग |
| `$?` | पिछले command का exit code |

```quiz
एक स्क्रिप्ट `./script.sh red green blue` से चलाई जाती है। `$1` और `$#` में
क्या है?
- [ ] `$1` है `./script.sh` और `$#` है `4`
- [x] `$1` है `red` और `$#` है `3`
- [ ] `$1` है `red` और `$#` है `blue`
---
स्क्रिप्ट का अपना नाम `$0` में होता है, इसलिए उसे `$#` में नहीं गिना जाता।
```

## Conditions – `if`

`if` एक command चलाता है और उसका **exit code** देखता है: 0 का मतलब true, और कुछ भी
दूसरा false। ज़्यादातर आप command `[` (जिसे `test` भी कहते हैं) इस्तेमाल करते हैं:

```sh
if [ -f ~/.bashrc ]; then echo "File मौजूद है"; else echo "File नहीं है"; fi
```

`[ ]` के अंदर के spaces ज़रूरी हैं! Script की तरह कई lines में लिखने पर यह ऐसा दिखता है:

```text
if [ "$answer" = "yes" ]; then
    echo "Great!"
elif [ "$answer" = "no" ]; then
    echo "Too bad."
else
    echo "Please answer yes or no."
fi
```

सबसे आम tests:

| Test | True कब |
|---|---|
| `-f FILE` | file मौजूद है (और एक regular file है) |
| `-d DIR` | directory मौजूद है |
| `-z "$x"` | variable ख़ाली है |
| `"$a" = "$b"` | strings बराबर हैं (`!=` अलग) |
| `$a -eq $b` | numbers बराबर हैं |
| `$a -lt $b` | इससे कम (`-le`, `-gt`, `-ge`, `-ne`) |
| `! CONDITION` | condition true *नहीं* है |

ध्यान दीजिए कि numbers की तुलना `-eq`, `-lt` वग़ैरह से होती है, जबकि `=` और `<` text
की तुलना करते हैं। Bash में `[[ ... ]]` भी है, जो थोड़ा ज़्यादा smart है: उसमें आप `&&`
और `||` लिख सकते हैं और `[[ $file == *.txt ]]` जैसे patterns से match कर सकते हैं।

छोटी conditions के लिए अक्सर `&&` और `||` काफ़ी होते हैं:

```sh
[ -d ~/{{pictures}} ] && echo "Pictures वाली directory मौजूद है"
```

```predict
$ x=""
$ if [ -z "$x" ]; then echo empty; else echo "not empty"; fi
empty
```

## Loops

**For loop** किसी list की हर चीज़ के लिए एक ही काम करता है:

```sh
for fruit in सेब केला कीवी; do echo "मुझे $fruit पसंद है"; done
```

List wildcards या किसी command से भी आ सकती है:

```sh
for file in ~/{{documents}}/*; do echo "File: $file"; done
for i in $(seq 1 3); do echo "Round $i"; done
```

**While loop** तब तक चलता रहता है जब तक condition true है:

```sh
i=1; while [ $i -le 3 ]; do echo $i; (( i++ )); done
```

किसी file को line by line पढ़ने का सबसे आम तरीक़ा `while read` है, जिसमें file को
`done` के बाद `<` से अंदर भेजा जाता है:

```sh
while read {{lineVar}}; do echo "> ${{lineVar}}"; done < ~/{{documents}}/{{fruits}}
```

`break` loop से बाहर निकलता है, और `continue` सीधे अगले round पर कूद जाता है।

```predict
$ for x in 2 4 6; do echo $(( x * 10 )); done
20
40
60
```

> **Infinite loops से सावधान!** जिस loop की condition कभी false नहीं होती, वह हमेशा
> चलता रहता है। असली terminal में आप उसे **Ctrl+C** से रोकते हैं। Simulator उसे 20,000
> steps के बाद ख़ुद रोक देता है।

## `case` से चुनना

जब किसी variable की बहुत सारी अलग-अलग values हो सकती हैं, तो `case`, `elif` की लंबी
chain से ज़्यादा साफ़ होता है:

```sh
file={{vacationPic}}
case $file in *.jpg|*.png) echo "An image";; *.txt) echo "A text file";; *) echo "Unknown type";; esac
```

हर विकल्प `;;` से ख़त्म होता है, और `*)` बाक़ी सब कुछ पकड़ लेता है।

## Functions

**Function** code का एक नाम वाला टुकड़ा है जिसे आप अपने ख़ुद के command की तरह call कर
सकते हैं। इसे arguments उसी तरह मिलते हैं जैसे किसी script को – `$1`, `$2` और `$#`:

```sh
greet() { echo "नमस्ते $1, स्वागत है!"; }
greet Kim
```

जो variables सिर्फ़ function के अंदर रहने चाहिए, वे `local` से बनाए जाते हैं, और
`return` function को एक exit code के साथ ख़त्म करता है।

## User से पूछना – `read`

`read` keyboard से एक line पढ़कर उसे एक variable में रखता है:

```sh
read -p "आपका नाम क्या है? " {{nameVar}}; echo "नमस्ते ${{nameVar}}!"
```

## एक पूरा उदाहरण

यह एक script है जो इस chapter की ज़्यादातर बातें इस्तेमाल करती है। यह arguments के रूप
में दी गई files का backup बनाती है:

```text
#!/bin/bash
# backup.sh – हर file को file.bak में copy करता है

if [ $# -eq 0 ]; then
    echo "Usage: $0 FILE..."
    exit 1
fi

for file in "$@"; do
    if [ -f "$file" ]; then
        cp "$file" "$file.bak"
        echo "Copied $file"
    else
        echo "Cannot find $file" >&2
    fi
done
```

`exit 1` script को exit code 1 के साथ ख़त्म करता है, ताकि जिसने भी script चलाई है वह देख
सके कि कुछ गड़बड़ हुई।

## अच्छी scripts के लिए tips

- `#!/bin/bash` से शुरू कीजिए और comments लिखिए।
- Variables को quotes में रखिए: `"$file"`, न कि `$file`।
- बहुत से लोग अपनी scripts `set -euo pipefail` से शुरू करते हैं, ताकि script आँख मूँदकर
  आगे बढ़ने के बजाय पहली ही error पर रुक जाए।
- Program **ShellCheck** bash scripts की आम ग़लतियाँ ढूँढता है – आप इसे हर बड़े
  distribution पर package manager से install कर सकते हैं।
