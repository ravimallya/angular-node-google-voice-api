import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  isCollapsed = true;
  title = 'audio-transcriber';

  constructor(private router: Router){}

  onLogout() {
    localStorage.clear();
    this.router.navigateByUrl('/login');
  }
}

