"""Check local roles, native profile replacement and member list rendering."""
from io import BytesIO
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from PIL import Image, ImageChops
import json
import os
import subprocess
import time
import urllib.request

ROOT = Path(__file__).resolve().parent
RUNTIME = ROOT / '.runtime'
SHOTS = RUNTIME / 'screenshots'
OUTPUT = RUNTIME / 'iconmaker-exports'
SHOTS.mkdir(exist_ok=True, parents=True)
OUTPUT.mkdir(exist_ok=True, parents=True)
URL = 'http://127.0.0.1:4173'
server = subprocess.Popen(['node', str(ROOT / 'server.mjs')], stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
for _ in range(60):
    try:
        urllib.request.urlopen(URL + '/ctm-themes', timeout=1).close()
        break
    except Exception:
        if server.poll() is not None:
            raise RuntimeError(server.stdout.read().decode())
        time.sleep(.1)
else:
    server.terminate()
    raise RuntimeError('IconMaker fixture did not start')

network = []
errors = []

def offline(route):
    if route.request.url.startswith(URL):
        route.continue_()
    else:
        network.append(route.request.url)
        route.abort()


def change_color(locator, color):
    locator.evaluate("(element, value) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, value); element.dispatchEvent(new Event('input', {bubbles:true})); element.dispatchEvent(new Event('change', {bubbles:true})); }", color)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE"))
    try:
        page = browser.new_page()
        page.goto(URL + '/fake-roles')
        owner = page.get_by_role('checkbox', name='Owner', exact=True)
        member = page.get_by_role('checkbox', name='Membro', exact=True)
        expect(member).to_be_checked()
        expect(owner).not_to_be_checked()
        expect(page.get_by_label('Perfil nativo')).to_contain_text('Membro')
        owner.check()
        expect(page.get_by_label('Perfil nativo')).to_contain_text('Owner')
        expect(page.get_by_label('Autor da mensagem')).to_have_css('color', 'rgb(255, 136, 0)')
        expect(page.get_by_label('Ícone do cargo na mensagem')).to_have_text('👑')
        owner.uncheck()
        assert page.get_by_label('Lista de membros').inner_text().splitlines() == ['3227436212982251533', 'Alice', 'Zoe', 'online', 'Haru']
        owner.check()

        assert page.get_by_label('Lista de membros').inner_text().splitlines() == ['3227436212982251533', 'Alice', 'Haru', 'Zoe']
        assert page.evaluate('window.roleFixture.originalRows().length') == 5
        profile = page.get_by_label('Cargos no perfil')
        expect(profile).to_contain_text('3227436212982251533')
        member.uncheck()
        expect(profile).not_to_contain_text('5227436212982251533')
        assert page.evaluate('window.roleFixture.realMember().roles') == ['5227436212982251533']
        page.get_by_role('checkbox', name='Integração', exact=True).check()
        page.get_by_label('Buscar cargos').fill('owner')
        expect(owner).to_be_visible()
        expect(member).not_to_be_visible()
        page.reload()
        expect(page.get_by_role('checkbox', name='Owner', exact=True)).to_be_checked()
        expect(page.get_by_role('checkbox', name='Membro', exact=True)).not_to_be_checked()
        page.get_by_role('button', name='Restaurar cargos originais').click()
        expect(page.get_by_role('checkbox', name='Owner', exact=True)).not_to_be_checked()
        expect(page.get_by_role('checkbox', name='Membro', exact=True)).to_be_checked()
        page.screenshot(path=str(SHOTS / 'fake-roles.png'), full_page=True)
        page.get_by_role('checkbox', name='Owner', exact=True).check()
        expect(page.get_by_label('Perfil nativo')).to_contain_text('Owner')
        page.evaluate('window.fakeRolesPlugin.stop()')
        expect(profile).not_to_contain_text('3227436212982251533')
        assert page.evaluate('window.roleFixture.realMember().roles') == ['5227436212982251533']
        expect(page.get_by_label('Perfil nativo')).not_to_contain_text('Owner')
        expect(page.get_by_label('Autor da mensagem')).to_have_css('color', 'rgb(153, 170, 181)')
        expect(page.get_by_label('Ícone do cargo na mensagem')).to_have_text('')
        assert page.get_by_label('Lista de membros').inner_text().splitlines() == ['3227436212982251533', 'Alice', 'Zoe', 'online', 'Haru']
        print('PASS FakeRoles browser: immediate checkbox and profile rendering, native member isolation, search, managed roles, persistence, reset and disable restoration.', flush=True)
    finally:
        browser.close()
        server.terminate()
        server.wait(timeout=10)
