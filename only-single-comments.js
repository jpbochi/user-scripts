// ==UserScript==
// @name         Only Single Comments
// @namespace    https://gist.githubusercontent.com/jpbochi/ac88177a0a4741300c2f24c4e33a9c90
// @version      1.0.5
// @description  On GitHub PR inline comments, changes the default button from "Start a review" to "Add single comment"
// @author       JP Bochi
// @match        https://github.com/*/*/pull/*
// @icon         https://www.google.com/s2/favicons?domain=github.com
// @downloadURL  https://raw.githubusercontent.com/duckduckgo/user-scripts/main/only-single-comments.js
// @updateURL    https://raw.githubusercontent.com/duckduckgo/user-scripts/main/only-single-comments.js
// @grant        none
// ==/UserScript==

/**
 * Made for https://www.tampermonkey.net
 */
(function () {
  'use strict';

  const defaultToSingleComment = (form) => {
    console.info('=>> Fixing form…', form);

    const existing = form.querySelector('input[type="hidden"][name="single_comment"]');
    if (existing) return;

    const newInput = document.createElement('input');
    newInput.setAttribute('type', 'hidden');
    newInput.setAttribute('name', 'single_comment');
    newInput.setAttribute('value', '1');
    form.insertBefore(newInput, form.firstChild)

    form.querySelector('.form-actions .btn-primary')?.classList.remove('btn-primary');
    form.querySelector('.form-actions button[name="single_comment"')?.classList.add('btn-primary')

    console.info('=>> Fixed inline comment form.');
  };

  const observe = (mutations, _observer) => {
    const addedNodes = Array.from(mutations)
      .filter(mutation => (mutation.type === 'childList'))
      .map(mutation => mutation.addedNodes)
      .flatMap(addedNodes => Array.from(addedNodes || []));

    console.info(`=>> Running only-single-comments script on ${addedNodes.length} new nodes…`);

    addedNodes
      .flatMap(added => Array.from(added.querySelectorAll('form.js-inline-comment-form')))
      .forEach(defaultToSingleComment);
  };
  const config = { attributes: false, childList: true, subtree: true };
  const targetNode = document.getElementById('repo-content-pjax-container');

  // Fix any pre-existing forms
  Array.from(targetNode.querySelectorAll('form.js-inline-comment-form'))
    .forEach(defaultToSingleComment);

  // Watch for new forms
  new MutationObserver(observe).observe(targetNode, config);
})();
