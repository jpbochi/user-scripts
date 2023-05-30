// ==UserScript==
// @name         Only Single Comments
// @namespace    https://github.com/jpbochi/user-scripts
// @version      1.1.1
// @description  On GitHub PR inline comments, changes the default button from "Start a review" to "Add single comment"
// @author       JP Bochi
// @match        *://github.com/*/*/pull/*
// @grant        none
// @run-at       document-idle
// @icon         https://external-content.duckduckgo.com/i/github.com.ico
// @downloadURL  https://raw.githubusercontent.com/jpbochi/user-scripts/master/only-single-comments.js
// @updateURL    https://raw.githubusercontent.com/jpbochi/user-scripts/master/only-single-comments.js
// ==/UserScript==

(function () {
  'use strict';

  const defaultToSingleComment = (form) => {
    const existing = form.querySelector('input[type="hidden"][name="single_comment"]');
    if (existing) return;

    console.debug('=>> Fixing form…', form);

    const newInput = document.createElement('input');
    newInput.setAttribute('type', 'hidden');
    newInput.setAttribute('name', 'single_comment');
    newInput.setAttribute('value', '1');
    form.insertBefore(newInput, form.firstChild)

    // github.com uses Button--primary, while some GitHub Enterprise instances may still use btn-primary.
    const reviewBtn = form.querySelector('.form-actions .Button--primary,.form-actions .btn-primary');
    const singleBtn = form.querySelector('.form-actions button[name="single_comment"')
    if (reviewBtn) {
      reviewBtn.classList.replace('Button--primary', 'Button--secondary');
      reviewBtn.classList.remove('btn-primary');
      console.debug('=>> Fixed review button.', reviewBtn);
    } else {
      console.warn('=>> No review button found!');
    }
    if (singleBtn) {
      singleBtn.classList.replace('Button--secondary', 'Button--primary');
      singleBtn.classList.add('btn-primary');
      console.debug('=>> Fixed single_comment button.', singleBtn);
    } else {
      console.warn('=>> No single_comment button found!');
    }

    console.info('=>> Fixed inline comment form.');
  };

  const observe = (mutations, _observer) => {
    const addedNodes = Array.from(mutations)
      .filter(mutation => (mutation.type === 'childList'))
      .map(mutation => mutation.addedNodes)
      .flatMap(addedNodes => Array.from(addedNodes || []))
      .filter(added => added.querySelectorAll);

    console.debug(`=>> Running only-single-comments script on ${addedNodes.length} new nodes…`);

    addedNodes
      .flatMap(added => Array.from(added.querySelectorAll('form.js-inline-comment-form')))
      .forEach(defaultToSingleComment);
  };

  const fixAll = () => {
    const targetNode = document.getElementById('js-repo-pjax-container');

    Array.from(targetNode.querySelectorAll('form.js-inline-comment-form'))
      .forEach(defaultToSingleComment);
  }

  // Fix any pre-existing forms
  fixAll();

  // Watch for new forms
  const config = { attributes: false, childList: true, subtree: true };
  const targetNode = document.getElementById('js-repo-pjax-container');
  new MutationObserver(observe).observe(targetNode, config);

  window.defaultToSingleComment = fixAll;
})();
