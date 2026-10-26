const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
(async () => {
 const root = process.cwd();
 const server = http.createServer((req,res) => {
  const file = path.resolve(root, '.' + new URL(req.url,'http://localhost').pathname);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) {res.writeHead(404);return res.end();}
  res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/plain');
  res.end(fs.readFileSync(file));
 });
 await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch();
 try {
  const context=await browser.newContext({viewport:{width:1360,height:1000},permissions:['clipboard-read','clipboard-write']});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/button-guide.html');
  const button=page.frameLocator('#preview').locator('button');
  await expect(button).toHaveText('Get help');
  await expect(button).toHaveCSS('background-color','rgb(103, 80, 164)');
  const starter=fs.readFileSync('button.html','utf8');
  await expect(page.locator('#source')).toHaveValue(starter);
  assert.equal(await page.locator('#preview').getAttribute('srcdoc'),starter);
  await page.getByLabel('Button text',{exact:true}).fill('Start learning');
  await expect(button).toHaveText('Start learning');
  await page.locator('[name=fontSize]').press('End');
  await expect(button).toHaveCSS('font-size','32px');
  await page.locator('[name=padY]').press('End');
  await expect(button).toHaveCSS('padding-top','32px');
  await page.locator('[name=padX]').press('End');
  await expect(button).toHaveCSS('padding-left','64px');
  await page.locator('[name=background]').fill('#0b6e4f');
  await expect(button).toHaveCSS('background-color','rgb(11, 110, 79)');
  await page.locator('[name=foreground]').fill('#ffff00');
  await expect(button).toHaveCSS('color','rgb(255, 255, 0)');
  for(const radius of ['0','12','999']) {
   await page.locator('[name=radius]').selectOption(radius);
   await expect(button).toHaveCSS('border-radius',radius+'px');
  }
  for(const horizontal of ['flex-start','center','flex-end']) {
   for(const vertical of ['flex-start','center','flex-end']) {
    await page.locator('[name=horizontal]').selectOption(horizontal);
    await page.locator('[name=vertical]').selectOption(vertical);
    await expect(page.frameLocator('#preview').locator('body')).toHaveCSS('justify-content',horizontal);
    await expect(page.frameLocator('#preview').locator('body')).toHaveCSS('align-items',vertical);
    const rect=await button.evaluate(n=>({x:n.getBoundingClientRect().x,y:n.getBoundingClientRect().y,w:n.getBoundingClientRect().width,h:n.getBoundingClientRect().height,vw:innerWidth,vh:innerHeight}));
    const x=horizontal==='flex-start'?32:horizontal==='center'?(rect.vw-rect.w)/2:rect.vw-rect.w-32;
    const y=vertical==='flex-start'?32:vertical==='center'?(rect.vh-rect.h)/2:rect.vh-rect.h-32;
    assert.ok(Math.abs(rect.x-x)<1 && Math.abs(rect.y-y)<1,JSON.stringify({horizontal,vertical,rect,x,y}));
   }
  }
  const edited=await page.locator('#source').inputValue();
  assert.equal(await page.locator('#preview').getAttribute('srcdoc'),edited);
  await page.getByRole('button',{name:'Copy HTML',exact:true}).click();
  await expect(page.locator('#copy-status')).toContainText('Copied.');
  assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),edited);
  const standalone=await context.newPage();
  await standalone.setContent(edited);
  await expect(standalone.locator('button')).toHaveText('Start learning');
  await expect(standalone.locator('button')).toHaveCSS('font-size','32px');
  await expect(standalone.locator('button')).toHaveCSS('background-color','rgb(11, 110, 79)');
  await expect(standalone.locator('body')).toHaveCSS('justify-content','flex-end');
  await expect(standalone.locator('body')).toHaveCSS('align-items','flex-end');
  await standalone.close();
  const literal='<img src=x onerror=alert(1)> & "go"';
  await page.getByLabel('Button text',{exact:true}).fill(literal);
  await expect(button).toHaveText(literal);
  await expect(page.frameLocator('#preview').locator('img')).toHaveCount(0);
  await page.getByRole('button',{name:'Reset to starter'}).click();
  await expect(page.locator('#source')).toHaveValue(starter);
  await expect(button).toHaveText('Get help');
  // Exercise the manual-copy path when the browser rejects clipboard writes.
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('denied')}}}));
  await page.getByRole('button',{name:'Copy HTML',exact:true}).click();
  await expect(page.locator('#copy-status')).toContainText('Code selected');
  assert.equal(await page.locator('#source').evaluate(n=>n.selectionEnd-n.selectionStart),starter.length);
  await page.getByRole('button',{name:'Reset to starter'}).click();
  await page.evaluate(()=>window.scrollTo(0,0));
  fs.mkdirSync('test-results',{recursive:true});
  await page.screenshot({path:'test-results/button-guide-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await expect(button).toHaveText('Get help');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Guide overflows on mobile');
  await page.screenshot({path:'test-results/button-guide-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('PASS: all five edit types, nine placements, copy/reproduction, escaped text, reset, clipboard fallback and mobile width.');
 } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
