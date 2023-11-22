import '@logseq/libs';


function manageSettings() {
  const highlightsRegEx = "(==.+?==)";
  const boldRegEx = "(\\*\\*.+?\\*\\*)";

  const settingsArray = [
    {
      key: "generalHeading",
      title: "⚙️ General settings",
      description: "",
      type: "heading",
      default: null
    },
    {
      key: "summaryTitle",
      title: "Parent block content for all extracted items",
      description: "",
      type: "string",
      default: "***Summary***",
    },
    {
      key: "keepSummaryAbove",
      title: "Keep summary above the block for extraction?",
      type: "boolean",
      description: "",
      default: "false",
    },
    {
      key: "keepRefs",
      title: "Keep a reference to the source block in the format [→](((uuid)))?",
      type: "boolean",
      description: "",
      default: "true",
    },
    {
      key: "refLabel",
      title: "Label to use for reference",
      description: "",
      type: "string",
      default: "→",
    },
    {
      key: "keepMeta",
      title: "Remove markdown meta syntax from highlights?",
      type: "boolean",
      description: "",
      default: "false",
    },

    {
      key: "advancedHeading",
      title: "☢️ Advanced settings",
      description: "",
      type: "heading",
      default: null
    },
    {
      key: "expr",
      title: "Regular Expression for extracting highlights",
      description: "",
      type: "string",
      default: `${highlightsRegEx}|${boldRegEx}`,
    }
  ]

  logseq.useSettingsSchema(settingsArray);
}

function main() {
  manageSettings();

  //targetBlock is the block under which the summary will be created.
  //For block extract this will be immediately below the current block.
  //For page extract it'll be the last block in the page.
  //If keepSummaryAbove is true then it'll be the first block in the page for pagePipeline.
  //If keepSummaryAbove is false then summary will appear above the summarized block for blockPipeline.
  var summarizeExtracts = async (extracts, targetBlock, keepSummaryAbove) => {
    if (extracts.length === 0) {
      logseq.UI.showMsg("Nothing to extract", "error", {timeout: 3000});
      return;
    }

    //Create a summary block below the current block (sibling)
    var summaryBlock = await logseq.Editor.insertBlock(
      targetBlock.uuid,
      logseq.settings.summaryTitle,
      { sibling: true, before: keepSummaryAbove }
    );

    //Create the extracts as children blocks of summary block
    extracts.forEach((i) => {
      let content = i.content;

      //Remove == or ** from start and end if keepMeta is false
      content = logseq.settings.keepMeta ? content : content.slice(2, -2);

      //Keep reference of source block
      content = logseq.settings.keepRefs
        ? `${content} [${logseq.settings.refLabel}](((${i.source.uuid})))`
        : content;
      if (!i.source.properties?.id)
        logseq.Editor.upsertBlockProperty(i.source.uuid, "id", i.source.uuid);

      logseq.Editor.insertBlock(summaryBlock.uuid, content, { sibling: false });
    });

    logseq.UI.showMsg("Extraction completed!", "success", {timeout: 3000});
  };


  const commandLabel = "Extract highlights";
  const regEx = new RegExp(logseq.settings.expr, "g");

  logseq.Editor.registerBlockContextMenuItem(commandLabel, async (e) => {
    const block = await logseq.Editor.getBlock(e.uuid, { includeChildren: true });
    const extracts = [...genExtracts([block], regEx)];

    summarizeExtracts(extracts, block, logseq.settings.keepSummaryAbove);
  });

  logseq.App.registerPageMenuItem(commandLabel, async (e) => {
    const pageBlocks = await logseq.Editor.getPageBlocksTree(e.page);
    const extracts = [...genExtracts(pageBlocks, regEx)];

    const targetBlock = pageBlocks[logseq.settings.keepSummaryAbove ? 0 : pageBlocks.length - 1];
    summarizeExtracts(extracts, targetBlock, logseq.settings.keepSummaryAbove);
  });
}

function* genExtracts(blocks, regEx) {
  for (const currentBlock of blocks) {
    //Find the extracts from the current block
    const currentBlockExtracts = currentBlock.content.matchAll(regEx);

    for (const [extract] of currentBlockExtracts)
      yield { content: extract, source: currentBlock };

    //If there are children then call this method recursively (filling the main extracts array which is passed as argument)
    if (currentBlock.children.length !== 0)
      yield* genExtracts(currentBlock.children, regEx)
  }
}

// bootstrap
logseq.ready(main).catch(console.error);
