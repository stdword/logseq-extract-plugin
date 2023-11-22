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
  manageSettings(logseq);

  const pluginSettings = logseq.settings;

  //targetBlock is the block under which the summary will be created.
  //For block extract this will be immediately below the current block.
  //For page extract it'll be the last block in the page.
  //If keepSummaryAbove is true then it'll be the first block in the page for pagePipeline.
  //If keepSummaryAbove is false then summary will appear above the summarized block for blockPipeline.
  var summarizeExtracts = async (extracts, targetBlock, keepSummaryAbove) => {
    //Create a summary block below the current block (sibling) - you can change content of this block
    //from Summary to something else by changing the summaryTitle property in settings
    var summaryBlock = await logseq.Editor.insertBlock(
      targetBlock.uuid,
      pluginSettings.summaryTitle,
      { sibling: true, before: keepSummaryAbove }
    );

    //Create the extracts as children blocks of summary block
    extracts.forEach((i) => {
      let content = i.content;

      //Remove == or ** from start and end if keepMeta is false
      content = pluginSettings.keepMeta ? content : content.slice(2, -2);

      //Keep reference of source block
      content = pluginSettings.keepRefs
        ? `${content} [*](((${i.source.uuid})))`
        : content;
      if (!i.source.properties?.id) {
        logseq.Editor.upsertBlockProperty(i.source.uuid, "id", i.source.uuid);
      }

      logseq.Editor.insertBlock(summaryBlock.uuid, content, { sibling: false });
    });

    logseq.App.showMsg("✔️ Extraction completed successfully!");
  };

  var processBlock = async (currentBlock) => {
    //Get current block content
    const block = await logseq.Editor.getBlock(currentBlock.uuid, {
      includeChildren: pluginSettings.nested,
    });
    const regEx = new RegExp(pluginSettings.expr, "g");

    //Get all extracts that match regex
    //const extracts = [...block.content.matchAll(regEx)];
    let extracts = [];
    getExtracts(block, regEx, extracts);
    //if extracts is empty then return

    return extracts;
  };

  //blockPipeline is the entry point when we extract at block level.
  var blockPipeline = async (currentBlock) => {
    let extracts = await processBlock(currentBlock);

    //EXIT if no extracts found
    if (!extracts || !extracts.length) {
      logseq.App.showMsg("❗ Nothing to extract!");
      return;
    }

    summarizeExtracts(extracts, currentBlock, pluginSettings.keepSummaryAbove);
  };

  //blockPipeline is the entry point when we extract at page level.
  var pagePipeline = async (context) => {
    let pageBlocks = await logseq.Editor.getPageBlocksTree(context.page);
    let summaryPosition = pluginSettings.keepSummaryAbove ? 0 : pageBlocks.length-1;
    let extracts = [];

    for (const block of pageBlocks) {
      let result = await processBlock(block);
      !!result && extracts.push(result);
    }

    extracts = extracts.flat();

    //EXIT if no extracts found
    if (!extracts || !extracts.length) {
      logseq.App.showMsg("❗ Nothing to extract!");
      return;
    }

    summarizeExtracts(extracts, pageBlocks[summaryPosition], pluginSettings.keepSummaryAbove);
  };

  //Extraction function which registers Extract as a context menu for a block
  logseq.Editor.registerBlockContextMenuItem("Extract", blockPipeline);

  //Extraction function which registers Extract as a context menu for a block
  logseq.App.registerPageMenuItem("Extract", pagePipeline);
  // logseq.App.registerPageMenuItem(
  //     'Extract', async (context) => {

  //         let pageBlocks = await logseq.Editor.getPageBlocksTree(context.page);
  //         pageBlocks.forEach((block) => processBlock(block));
  //     }
  // );
}

function getExtracts(currentBlock, regEx, extracts) {
  //Get children of the current block
  let children = currentBlock.children;

  //Find the extracts from the current block
  let currentBlockExtracts = [...currentBlock.content.matchAll(regEx)];

  //Create a map from current block's extracts
  let currentBlockExtractsWithBlockRef = currentBlockExtracts.map((e) => {
    return { content: e[0], source: currentBlock };
  });

  //Push the extracts map from current block into main extracts array
  !!currentBlockExtracts.length &&
    extracts.push(...currentBlockExtractsWithBlockRef);

  //If there are children then call this method recursively (filling the main extracts array which is passed as argument)
  !!children.length && children.forEach((c) => getExtracts(c, regEx, extracts));
  return;
}

// bootstrap
logseq.ready(main).catch(console.error);
