// ==UserScript==
// @name         Asana Helpers - Markdown et al
// @description  Adds buttons (Markdown, Expand Comments, Theme Switch, Read-Only Mode), plus paste in markdown format.
// @namespace    https://github.com/jpbochi/user-scripts
// @version      1.5.1
// @author       Nick Goossens, JP Bochi, Karl K
// @match        *://app.asana.com/*
// @run-at       document-idle
// @require      https://cdn.jsdelivr.net/npm/marked@4.3.0/lib/marked.umd.min.js
// @icon         https://external-content.duckduckgo.com/i/asana.com.ico
// @downloadURL  https://raw.githubusercontent.com/jpbochi/user-scripts/master/asana-helpers-markdown.js
// @updateURL    https://raw.githubusercontent.com/jpbochi/user-scripts/master/asana-helpers-markdown.js
// @require      https://openuserjs.org/src/libs/sizzle/GM_config.js
// @grant        GM.registerMenuCommand
// @grant        GM.unregisterMenuCommand
// @grant        GM.getValue
// @grant        GM.setValue
// ==/UserScript==

(function () {
  'use strict';

  const buttonDivId = '__helpers_div__';
  let autoReadOnlyMenuId = null;

  const buildButton = (content, onClick, title, ...classes) => {
    var btn = document.createElement('button');
    btn.innerHTML = content;
    btn.classList.add(
      'IconButtonThemeablePresentation', 'IconButtonThemeablePresentation--medium', 'IconButtonThemeablePresentation--isEnabled',
      'CountAvatar', 'CountAvatar--small', 'CountAvatar--standardTheme',
      ...[classes].flat()
    );
    btn.style.setProperty('border-radius', '50%');

    btn.setAttribute('title', title || '');
    btn.onclick = onClick;
    btn.onauxclick = onClick;
    return btn;
  };

  const buildSeparator = (klass, margin) => {
    var sep = document.createElement('div');
    klass ||= 'TextEditorFixedToolbar-divider';
    margin ||= '8px';
    sep.classList.add(klass);
    sep.style.setProperty('margin', margin);
    return sep;
  };

  // Helper functions for https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
  const getAddedNodes = (mutations) =>
    Array.from(mutations)
      .filter((mutation) => mutation.type === 'childList')
      .map((mutation) => mutation.addedNodes)
      .flatMap((nodes) => Array.from(nodes || []));

  const queryAll = (nodes, query) => [
    ...nodes.filter((node) => node.matches && node.matches(query)),
    ...nodes.flatMap((node) => Array.from(node.querySelectorAll ? node.querySelectorAll(query) : [])),
  ];

  const animateButton = (button) => {
    button.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(360deg)' }], { duration: 250, iterations: 1 });
  };

  const setupButtons = () => {
    const preexisting = document.getElementById(buttonDivId);
    if (preexisting) return;

    const buttonDiv = document.createElement('div');
    buttonDiv.id = buttonDivId;
    buttonDiv.classList.add('OmnibuttonButtonCard', 'ThemeableCardPresentation');
    Object.entries({
      position: 'absolute',
      top: '0.44rem',
      left: '12rem',
      'z-index': 50, // Setting to 50 just in case there are other elements with z-index 1
    }).forEach(([prop, value]) => { buttonDiv.style.setProperty(prop, value); });

    buttonDiv.append(
      buildButton(
        '\u262F', switchTheme, 'Switch dark/light themes.',
        '__theme', 'OmnibuttonButtonCard-iconContainer',
      ),
      buildSeparator('__none', '2px'),
      buildButton(
        '\u2195', showAllComments, 'Expand all comments.',
        '__expand', 'OmnibuttonButtonCard-iconContainer',
      ),
      buildSeparator('__none', '2px'),
      buildButton(
        '\u26AD', getMDLink, 'Copy task/message link as Markdown. With Meta/Ctrl, opens it on a new tab.',
        '__md_link', 'OmnibuttonButtonCard-iconContainer',
      )
    );
    document.body.appendChild(buttonDiv);

    waitForEditorThenConfigureIt().catch(err => console.error(err));
    window.removeEventListener('focus', setupButtons);
  };

  window.addEventListener('load', setupButtons);
  window.addEventListener('pageshow', setupButtons);
  window.addEventListener('focus', setupButtons);

  // window.navigation is not supported by all browsers (https://caniuse.com/mdn-api_window_navigation)
  if (window.navigation) {
    window.navigation.addEventListener('navigate', () => {
      console.debug('=>> navigate event. Refreshing readonly button state in 99ms…');
      setTimeout(() => waitForEditorThenConfigureIt().catch(err => console.error(err)), 99);
    });
  }

  // Handle Markdown paste. If the content it already text/html it is pasted as it to allow
  // copy/paste from other tasks. On macOS you can paste as text using Cmd+Alt+Shift+V.
  const marked = window.marked;
  marked.setOptions({
    gfm: true,
    breaks: true,
  });

  document.addEventListener('paste', (event) => {
      var editor = getEditor(event.target.parentElement);

      const { types } = event.clipboardData;
      if (!editor || event.isMarkdownFormatEvent || !types.contains('text/plain') || types.contains('text/html')) {
        return;
      }

      event.stopImmediatePropagation();
      event.stopPropagation();
      event.preventDefault();

      var pastedText = event.clipboardData.getData('text/plain');
      var parsedMarkdown = marked.parse(pastedText);

      var clipboardData = new DataTransfer();
      var clipboardEvent = new ClipboardEvent('paste', { clipboardData });
      clipboardEvent.clipboardData.setData('text/html', parsedMarkdown);
      clipboardEvent.isMarkdownFormatEvent = true;

      editor.dispatchEvent(clipboardEvent);
    },
    { capture: true }
  );

  // Find the parent editor associated with this element
  function getEditor(element) {
    let isEditor = false;
    const iterator = element.classList.values();
    for (const cls of iterator) {
      if (cls.startsWith('ProsemirrorEditor')) {
        isEditor = true;
        break;
      }
    }

    if (isEditor) {
      let editor = element;
      while (editor && !editor.classList.contains('ProsemirrorEditor')) {
        editor = editor.parentElement;
      }
      return editor;
    }
    return null;
  }

  const waitForAddedNode = (rootElement, targetSelector, timeoutMs) => {
    const preexisting = rootElement.querySelector(targetSelector);
    if (preexisting) return Promise.resolve(preexisting);

    return new Promise((resolve, reject) => {
      const start = Date.now();
      const observer = new MutationObserver((mutations) => {
        if ((Date.now() - start) > timeoutMs) {
          console.debug(`=>> Timed out waiting for '${targetSelector}'.`);
          observer.disconnect();
          return reject('Observer wait timeout.');
        }

        const [target] = queryAll(getAddedNodes(mutations), targetSelector);
        if (target) {
          console.debug(`=>> Found '${targetSelector}'.`, { target });
          observer.disconnect();
          return resolve(target);
        }
        console.debug(`=>> Still waiting for '${targetSelector}'...`);
      });

      console.debug('=>> Observing…', rootElement);
      observer.observe(rootElement, { subtree: true, childList: true });
    });
  };

  const getCurrentTaskUrlFromCopyLinkButton = async () => {
    const observerWaitingForSuccessNotification =
      waitForAddedNode(document.querySelector('.ToastManager'), '.ToastNotificationContent', 5000);
    document.querySelector('.TaskPaneToolbar-copyLinkButton,.ConversationToolbar-copyLinkButton').click();

    console.info('=>> Waiting for copied link…');
    await observerWaitingForSuccessNotification;
    console.info('=>> Reading copied link…');
    const href = await navigator.clipboard.readText();
    console.debug('=>> Read:', { href }); // TODO: should we verify that the href is actually an URL pointing to app.asana.com?
    return href;
  };

  const getCurrentTaskUrlFromPage = async () => {
    const taskPane = document.querySelector('.TaskPane[data-task-id]');
    if (taskPane) {
      const taskId = taskPane.getAttribute('data-task-id');
      return `https://app.asana.com/0/0/${taskId}/f`;
    }

    const conversationLink = document.querySelector('.ConversationPane .ConversationTitleAndContext-title a[href]');
    if (conversationLink) return conversationLink.href;

    // Fallback to Asana's "Copy Link" button.
    return await getCurrentTaskUrlFromCopyLinkButton();
  };

  // Get a Markdown link for the current task formatted as [Task Title](Link)
  const getMDLink = async (ev) => {
    console.debug('=>> Click:', ev);
    const href = await getCurrentTaskUrlFromPage();

    if (ev.metaKey || ev.ctrlKey || ev.altKey || ev.button === 1) {
      // meta for MacOS, ctrl for Windows, middle click, or alt for good measure
      console.info('=>> Opening tab…', { href });
      animateButton(ev.srcElement);
      return window.open(href, '_blank', { noopener: true, noreferrer: true }).focus();
    }

    var title = document.querySelector('.TaskPaneToolbarAnimation-title,.ConversationTitleAndContext-title').innerText;
    var markdown = `[${title}](${href})`;
    console.info('=>> Pasting…', { markdown });
    await navigator.clipboard.writeText(markdown);
    animateButton(ev.srcElement);
  };

  const refreshReadOnlyState = (taskEditor) => {
    taskEditor ||= document.querySelector('#TaskDescription .ProseMirror');

    // '\u{1F4DD}' = 📝; '\u{1F4D6}' = 📖
    const editable = taskEditor.getAttribute('contenteditable') === 'true';
    const icon = editable ? '\u{1F4DD}' : '\u{1F4D6}';

    Array.from(
      document.querySelectorAll(`#${buttonDivId} .__readonly, .TextEditorFixedToolbar .__readonly`)
    ).forEach(button => {
      button.innerHTML = icon;
      button.classList.toggle('SubtleIconToggleButton--isPressed', !editable);
      button.classList.toggle('SubtleIconToggleButton--isNotPressed', editable);
    });
  };

  const updateMenuCommands = async () => {
    const autoReadOnlyEnabled = await GM.getValue('autoReadOnlyEnabled', false);
    console.info('=>> Config loaded.', { autoReadOnlyEnabled });

    if (autoReadOnlyMenuId) { await GM.unregisterMenuCommand(autoReadOnlyMenuId); }

    const menuText = autoReadOnlyEnabled ? 'Disable auto read-only!' : 'Enable auto read-only!';
    autoReadOnlyMenuId = await GM.registerMenuCommand(menuText, async () => {
      const autoReadOnlyEnabled = await GM.getValue('autoReadOnlyEnabled', false);
      await GM.setValue('autoReadOnlyEnabled', !autoReadOnlyEnabled);
      await updateMenuCommands();

      if (!autoReadOnlyEnabled) { resetReadOnlyState(); }
    });
  };

  const waitForEditorThenConfigureIt = async () => {
    updateMenuCommands();


    waitForAddedNode(document, '.TaskPane, .ConversationPane', 9000).then(pane => {
      if (!pane.querySelector('.__md_link')) pane.querySelector('.TaskPaneToolbar-copyLinkButton, .ConversationToolbar-copyLinkButton')?.after(
        buildButton(
          '\u26AD', getMDLink, 'Copy task/message link as Markdown. With Meta/Ctrl, opens it on a new tab.',
          // NOTE: TaskPaneToolbar-button adds 'margin-left: 8px;'
          '__md_link', 'TaskPaneToolbar-button'
        ),
      );
      if (!pane.querySelector('.__expand')) pane.querySelector('.FollowersBar')?.prepend(
        buildButton('\u2195', showAllComments, 'Expand all comments.', '__expand'),
        buildSeparator(),
      );
    });
    waitForAddedNode(document, '.TaskStoryFeed .TabList', 9000).then(tabList => {
      if (!tabList.querySelector('.__expand')) {
        tabList.append(
          buildSeparator('__none', '12px'),
          buildButton('\u2195', showAllComments, 'Expand all comments.', '__expand'),
        );
      };
    });

    const taskEditor = await waitForAddedNode(document, '#TaskDescription .ProseMirror', 9000);
    setTimeout(() => resetReadOnlyState(taskEditor).catch(err => console.error(err)), 200);
  }

  const asanaHelperShouldTaskBeEditable = () => {
    const userSelf = document.querySelector('.CommentComposer .AvatarButton .AvatarPhoto-image')?.style.backgroundImage;
    const assignee = document.querySelector('#task_pane_assignee_input .AvatarPhoto-image')?.style.backgroundImage;
    const creator = document.querySelector('.TaskStoryFeed-taskCreationStory .AvatarPhoto-image')?.style.backgroundImage;
    const userSelfInitials = document.querySelector('.CommentComposer .AvatarButton .AvatarPhoto')?.innerText;
    const assigneeInitials = document.querySelector('#task_pane_assignee_input .AvatarPhoto')?.innerText;
    const creatorInitials = document.querySelector('.TaskStoryFeed-taskCreationStory .AvatarPhoto')?.innerText;

    const editable = (
      (assignee === userSelf) || (creator === userSelf)
    );
    console.debug('==> Should task be editable?', {
      editable, user: userSelfInitials, assignee: assigneeInitials, creator: creatorInitials,
    });
    return editable;
  };

  const resetReadOnlyState = async (taskEditor) => {
    taskEditor ||= document.querySelector('#TaskDescription .ProseMirror');
    const autoReadOnlyEnabled = await GM.getValue('autoReadOnlyEnabled', false);
    if (autoReadOnlyEnabled) {
      const editable = asanaHelperShouldTaskBeEditable();
      console.info('==> Task editor editable reset.', { editable });
      taskEditor.setAttribute('contenteditable', editable);
    }

    const editorToolbar = taskEditor.parentElement.querySelector('.TextEditorFixedToolbar');
    if (!editorToolbar.querySelector('.__readonly')) {
      editorToolbar.appendChild(buildButton(
        '?', toggleReadOnly, 'Toggles task\'s contenteditable on/off.',
        '__readonly',
        'SubtleIconToggleButton', 'SubtleIconToggleButton--standardTheme', 'SubtleIconToggleButton--isNotPressed',
      ));
    }

    // Prevent double new tabs, when middle clicking on a link, on a non-editable editor.
    taskEditor.onmouseup = (ev) => {
      const editable = taskEditor.getAttribute('contenteditable') === 'true';
      if (!editable) {
        ev.stopPropagation();
      }
    };

    refreshReadOnlyState(taskEditor);
  };

  const toggleReadOnly = (ev) => {
    const taskEditor = document.querySelector('#TaskDescription .ProseMirror');
    const editable = taskEditor.getAttribute('contenteditable') === 'true';
    taskEditor.setAttribute('contenteditable', !editable);

    refreshReadOnlyState(taskEditor);
    animateButton(ev.srcElement);
  };

  // Switch between dark and light themes
  function switchTheme(ev) {
    const currentTheme = document.body.classList;

    const targetTheme =
      currentTheme.contains('DesignTokenThemeSelectors-theme--darkMode') || currentTheme.contains('DesignTokenThemeSelectors-theme--systemDarkMode')
        ? 'DesignTokenThemeSelectors-theme--lightMode'
        : 'DesignTokenThemeSelectors-theme--darkMode';

    currentTheme.remove(
      'DesignTokenThemeSelectors-theme--systemDarkMode',
      'DesignTokenThemeSelectors-theme--systemLightMode',
      'DesignTokenThemeSelectors-theme--darkMode',
      'DesignTokenThemeSelectors-theme--lightMode'
    );
    currentTheme.add(targetTheme);

    animateButton(ev.srcElement);
  }

  // Expand all comments and show all their details
  function showAllComments(ev) {
    var elements = document.getElementsByClassName('TaskStoryFeed-expandLink');

    for (var index = 0; index < elements.length; ++index) {
      const element = elements[index];
      if (element && !element.innerText.includes('Hide')) {
        element.click();
      }
    }

    // Hack to get all comments to show
    for (var i = 1; i <= 5; i++) {
      setTimeout(showComments, i * 100);
    }
    animateButton(ev.srcElement);
  }

  function showComments() {
    var elements = document.getElementsByClassName('TruncatedRichText-expand');

    for (var index = 0; index < elements.length; ++index) {
      const element = elements[index];
      if (element) {
        element.click();
      }
    }
  }
})();
