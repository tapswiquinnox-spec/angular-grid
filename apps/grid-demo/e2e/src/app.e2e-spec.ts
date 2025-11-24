import { browser, by, element } from 'protractor';

describe('Grid Demo App', () => {
  beforeEach(() => {
    browser.get('/');
  });

  it('should display the grid', () => {
    expect(element(by.css('lib-data-grid')).isPresent()).toBeTruthy();
  });

  it('should switch between client and server mode', () => {
    const serverButton = element(by.buttonText('Server-Side (Simulated)'));
    serverButton.click();
    expect(serverButton.getAttribute('class')).toContain('active');
  });
});


