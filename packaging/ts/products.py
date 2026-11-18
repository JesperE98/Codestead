#!/usr/bin/env python3
"""The products of packaging/products.json for the TypeScript packaging workflow (.github/workflows/ts-packaging.yml).

The same names, ids and executables as packaging/plan.py gives the release workflow (from the C# projects' properties),
plus the TypeScript app of each product (ts/apps/<key>). The version is the product's major.minor with patch 0, as in
local builds: these builds are install-tested, never published. Writes products=[...] to $GITHUB_OUTPUT.
"""
import json
import os
import subprocess


def main():
    products = []
    for p in json.load(open("packaging/products.json")):
        out = subprocess.check_output(["dotnet", "msbuild", p["project"], "-getProperty:AssemblyName",
                                       f"-getProperty:{p['idProperty']}", f"-getProperty:{p['nameProperty']}",
                                       f"-getProperty:{p['versionProperty']}"], text=True)
        props = json.loads(out)["Properties"]
        app = f"ts/apps/{p['key']}"
        if not os.path.isfile(os.path.join(app, "package.json")):
            raise SystemExit(f"{p['key']}: no TypeScript app in {app}")
        product = {"key": p["key"], "id": props[p["idProperty"]], "name": props[p["nameProperty"]],
                   "version": props[p["versionProperty"]] + ".0", "exe": props["AssemblyName"],
                   "project": p["project"], "summary": p["summary"], "dir": p["dir"], "app": app}
        products.append(product)
        print(f"{product['name']} {product['version']}: {app} as {product['exe']}")
    with open(os.environ.get("GITHUB_OUTPUT", os.devnull), "a") as f:
        f.write(f"products={json.dumps(products)}\n")


if __name__ == "__main__":
    main()
