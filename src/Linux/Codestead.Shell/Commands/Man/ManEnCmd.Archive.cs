namespace Codestead.Shell.Commands;

// English summaries and man pages for the archive commands (archive.ts), one part of the ManEn table.

public static partial class ManEnCmd
{
    private const string GzipMan = """
        NAME
               gzip, gunzip, zcat - compress and decompress files

        SYNOPSIS
               gzip [-k] [-v] [-d] [-c] [-l] FILE...
               gunzip FILE.gz...
               zcat FILE.gz...

        DESCRIPTION
               gzip compresses ONE file at a time: file.txt is replaced by the
               smaller file file.txt.gz. Permissions and timestamp are kept. To
               compress a whole directory, first bundle it with tar (or use
               tar -z directly).

               gunzip is the same as gzip -d, and zcat the same as gzip -dc:
               zcat prints the contents without unpacking the file.

               Very small files often get BIGGER when compressed, because gzip
               adds a header containing, among other things, the file name.

        OPTIONS
               -k, --keep         keep the original file
               -d, --decompress   decompress (like gunzip)
               -c, --stdout       write the result to standard output
               -l, --list         show the size before and after compression
               -v, --verbose      tell how much smaller the file became
               -r, --recursive    compress every file in directories, one by one
               -f, --force        overwrite files that already exist
               -1 ... -9          faster (-1) or better (-9) compression

        EXAMPLES
               gzip -kv server.log         compress, but keep the original
               gzip -l server.log.gz       how much did we save?
               zcat server.log.gz | grep ERROR
        """;

    private static OrderedDictionary<string, (string Summary, string? Man)> ArchivePages => new()
    {
        // ---------- Arkiv (archive.ts) ----------
        ["tar"] = ("Bundles files into an archive (.tar, .tar.gz) and unpacks them", """
            NAME
                   tar - bundle files into an archive, and unpack them again
                         (tape archive)

            SYNOPSIS
                   tar -c [-v] [-z] -f ARCHIVE FILE...      create an archive
                   tar -t [-v] [-z] -f ARCHIVE              list the contents
                   tar -x [-v] [-z] -f ARCHIVE [-C DIR]     unpack

            DESCRIPTION
                   tar collects many files and directories into ONE file, an archive.
                   Permissions, owners and timestamps come along. tar does not compress
                   by itself – with -z the archive is passed through gzip, and then the
                   file is usually called .tar.gz or .tgz.

                   The options can be written together, and the dash can be left out:
                   tar -czvf, tar czvf and tar -c -z -v -f all mean the same thing.

            OPTIONS
                   -c, --create       create a new archive
                   -x, --extract      unpack (extract)
                   -t, --list         list the contents (table of contents)
                   -v, --verbose      show the files being handled; with -t in ls -l format
                   -f, --file=ARCHIVE the archive file. Put f last among combined
                                      options, since the file name must follow it directly
                   -z, --gzip         compress/decompress with gzip
                   -C, --directory=DIR  change to the directory DIR first (with -x:
                                      unpack there instead of in the current directory)
                   -p                 keep the permissions exactly when unpacking

            EXAMPLES
                   tar -czvf dokument.tar.gz dokument     bundle and compress
                   tar -tzvf dokument.tar.gz              look inside the archive
                   tar -xzvf dokument.tar.gz -C /tmp      unpack into /tmp

            MNEMONIC
                   c = create, x = extract, t = list, z = gzip, v = verbose, f = file.
                   "Create Zipped Verbose File" – czvf.
            """),
        ["gzip"] = ("Compresses files (file → file.gz)", GzipMan),
        ["gunzip"] = ("Unpacks .gz files (same as gzip -d)", GzipMan),
        ["zcat"] = ("Shows the contents of .gz files without unpacking them", GzipMan),
        ["zip"] = ("Bundles and compresses files into a .zip file", """
            NAME
                   zip - bundle and compress files into a zip archive

            SYNOPSIS
                   zip [-r] [-q] [-j] ARCHIVE.zip FILE...

            DESCRIPTION
                   zip does both what tar and gzip do: it bundles several files into
                   an archive and compresses them. The format comes from the Windows
                   world, so choose zip when sending files to someone who doesn't run Linux.

                   If the archive already exists, the files are added to (or updated
                   in) it. If ARCHIVE has no file extension, .zip is added.

            OPTIONS
                   -r    include directories and all their contents (recursive). Without -r
                         only the empty directory is added!
                   -q    quiet – print nothing
                   -j    store only the file names, not the directories (junk paths)

            EXAMPLES
                   zip -r dokument.zip dokument
                   zip pictures.zip picture1.png picture2.png

            SEE ALSO
                   unzip(1), tar(1)
            """),
        ["unzip"] = ("Unpacks .zip files", """
            NAME
                   unzip - list and extract files from a zip archive

            SYNOPSIS
                   unzip [-l] [-o] [-n] [-q] ARCHIVE.zip [FILE...] [-d DIRECTORY]

            DESCRIPTION
                   Extracts all files (or only the ones given) into the current
                   directory. Permissions come along, but the files are owned by you.

                   Files that already exist are skipped. Use -o to overwrite them.

            OPTIONS
                   -l              list the contents, don't extract
                   -d DIRECTORY    extract into DIRECTORY (created if missing)
                   -o              overwrite existing files without asking
                   -n              never overwrite existing files
                   -q              quiet – print nothing

            EXAMPLES
                   unzip -l dokument.zip
                   unzip dokument.zip -d unpacked
            """),
        ["du"] = ("Shows how much disk space files and directories use", """
            NAME
                   du - show how much disk space files and directories use
                        (disk usage)

            SYNOPSIS
                   du [OPTION]... [FILE]...

            DESCRIPTION
                   Shows the size of every directory (and subdirectory) in kilobytes.
                   Without FILE the current directory is shown.

                   The disk is divided into blocks of 4 KiB, so even a 10-byte file
                   takes up 4.0K on disk. You see the real size with --apparent-size
                   or with ls -l.

            OPTIONS
                   -h, --human-readable   human-readable sizes (4.0K, 12M, 1.5G)
                   -s, --summarize        show only one total per argument
                   -a, --all              also show files, not only directories
                   -c, --total            add a line with the grand total
                   -d, --max-depth=N      only show N levels down
                   -b, --bytes            real size in bytes (--apparent-size)
                       --apparent-size    real size instead of disk usage

            EXAMPLES
                   du -sh dokument                 how big is the directory?
                   du -h -d 1 ~                    the size of everything in the home directory
                   du -h dokument.tar dokument.tar.gz
            """),
    };
}
