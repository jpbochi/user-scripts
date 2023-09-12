// ==UserScript==
// @name         Only Single Comments
// @namespace    https://github.com/jpbochi/user-scripts
// @version      1.2.0
// @description  On GitHub PR inline comments, changes the default button from "Start a review" to "Add single comment"
// @author       JP Bochi
// @match        *://github.com/**
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
    const pullReqHeader = document.getElementById('partial-discussion-header');
    if (!pullReqHeader) { return console.debug('=>> Not a PR page, ignoring…'); }

    const addedNodes = Array.from(mutations)
      .filter(mutation => (mutation.type === 'childList'))
      .map(mutation => mutation.addedNodes)
      .flatMap(addedNodes => Array.from(addedNodes || []))
      .filter(added => added.querySelectorAll);

    console.debug(`=>> Running only-single-comments script on ${addedNodes.length} new nodes…`);

    addedNodes
      .flatMap(added => Array.from(added.querySelectorAll('form.js-inline-comment-form')))
      .forEach(defaultToSingleComment);

    addCopyMDLinkButton(pullReqHeader);
  };

  const buildButton = (content, onClick, title, ...classes) => {
    var btn = document.createElement('button');
    btn.innerHTML = content;
    btn.classList.add(
      'Button--secondary', 'Button--small', 'Button',
      ...[classes].flat()
    );
    btn.style.setProperty('border-radius', '50%');

    btn.setAttribute('title', title || '');
    btn.onclick = onClick;
    btn.onauxclick = onClick;
    return btn;
  };
  const animateButton = (button) => {
    button.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(360deg)' }], { duration: 250, iterations: 1 });
  };

  // Get a Markdown link for the current PR formatted as [Achieve Greatness • jpbochi/user-scripts#44](https://github.com/jpbochi/user-scripts/pull/44)
  const getMDLink = async (ev) => {
    console.debug('=>> Click:', ev);
    const href = document.querySelector('meta[property="og:url"]').content;
    // Object.fromEntries(Array.from(document.querySelectorAll('meta[property]')).map(x => [x.getAttribute('property'), x.content]))

    // '\u00B7' = '·'; '\u2022' = '•'
    const repoPath = document.querySelector('meta[property="og:title"]').content.split(' ').pop();
    const title = document.querySelector('h1.gh-header-title').innerText.replace(/#([0-9]+)$/, `\u2022 ${repoPath}#$1`);

    var markdown = `[${title}](${href})`;
    console.info('=>> Pasting…', { markdown });
    await navigator.clipboard.writeText(markdown);
    animateButton(ev.srcElement);
  };

  const addCopyMDLinkButton = (headerContainer) => {
    const headerActions = (headerContainer || document).querySelector('.gh-header-actions');

    if (headerActions && !headerActions.querySelector('.__md_link')) {
      // '\u{1F517}' = '🔗'; '\u{26AD}' = '⚭'
      headerActions.appendChild(buildButton(
        '\u{1F517}', getMDLink, 'Copy PR link as Markdown', '__md_link',
      ));
    }
  };

  const setup = () => {
    const mainContainer = document.getElementById('js-repo-pjax-container');
    if (!mainContainer) {
      return;
    }
    if (mainContainer.classList.contains('__observed')) {
      return console.debug('=>> Already observing container…');
    }
    // Fix any pre-existing forms
    Array.from(mainContainer.querySelectorAll('form.js-inline-comment-form'))
      .forEach(defaultToSingleComment);

    console.debug('=>> Observing PR container for new forms…', { mainContainer });
    new MutationObserver(observe).observe(
      mainContainer,
      { attributes: false, childList: true, subtree: true }
    );
    mainContainer.classList.add('__observed');

    addCopyMDLinkButton(mainContainer);
  };

  window.addEventListener('load', setup);
  window.addEventListener('pageshow', setup);
  window.addEventListener('focus', setup);
  window.navigation.addEventListener('navigate', setup);
})();
