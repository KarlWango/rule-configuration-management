# Rule Configuration Manager

Move proven design rules from one PCB to another in a few clicks.

Keep a team rule set on a reference PCB, then reuse it on new boards. You can also organize power, sampling and control nets as net sets, so you do not have to create net-to-net rules one by one. Before writing, the extension shows what will be added, changed or skipped. After writing, you can roll back if needed.

![Rule Configuration menu in the PCB editor](docs/screenshots/menu.png)

## When to use it

- Reuse clearance, track, plane and other rules from a proven PCB.
- Share one rule set with teammates instead of maintaining rules on every board.
- Turn a customer net list into net-to-net rules quickly.
- Check a diff before importing and roll back after importing.

## Three main features

### 1. Export design rule configuration

Open a PCB and choose **Rule Configuration > Export Design Rule Configuration**. Select the modules to include, set a file name, and export one JSON file.

The export includes:

- Rule management values such as clearance, track, plane, solder-mask and stencil rules.
- Net rules assigned to individual nets.
- Net-to-net rules between specific nets.
- Net classes, differential pairs and equal-length groups.

The left side of the export dialog also supports **additional net-set rules**. Fill one set and pick a rule to assign that rule to several nets quickly, or fill two sets and pick a rule to describe the rules between the two groups. These nets do not have to exist on the current PCB, so you can save a complete team template even before the board is finished.

![Export design rule configuration dialog](docs/screenshots/export.png)

### 2. Add net-set rules in bulk

When one rule covers many nets, use the CSV template. Its header is:

```csv
setA,classA,setB,classB,rule
```

- `setA` / `setB`: net sets, separated by `/`.
- `classA` / `classB`: optional. On import, these nets are put into the named net classes.
- `rule`: the rule to assign to this set pair.

Each row becomes one net-set rule. On import, the extension matches the nets on the target PCB, skips missing nets and reports them in the log.

![Additional net-set CSV template](docs/screenshots/csv-template.png)

### 3. Review the diff before import

On the target PCB, choose **Import Design Rule Configuration**, pick the JSON file, then review the diff. You can see what will be added, what will change, and what will be skipped because a net is missing. Import only after the preview looks right.

After the import, check the result and log. If you picked the wrong file or target PCB, click **Restore to pre-import state** to return to the previous state.

![Import diff preview](docs/screenshots/import-preview.png)

![Import result and restore button](docs/screenshots/import-result.png)

## Practical notes

- Net names are matched case-insensitively, so `GND` and `gnd` are treated as the same net.
- If either net in a differential pair is missing, that pair is not imported.
- Existing net classes, differential pairs and equal-length groups are not deleted; the extension only adds items or moves member nets.
- Some rule groups and plain net-rule entries cannot be deleted through the platform API. The preview and log explain these cases instead of silently changing unrelated rules.
- The extension handles rules and relationships only; it does not move or modify graphical PCB objects.

## Installation

1. Open EasyEDA Pro.
2. Go to **Settings > Extensions > Extension Manager**.
3. Install a local extension and select the `.eext` file.
4. Enable the extension and refresh the editor. The **Rule Configuration** menu appears in the PCB editor.

Works with EasyEDA Pro V3.2 and later. The UI supports Simplified Chinese and English.
