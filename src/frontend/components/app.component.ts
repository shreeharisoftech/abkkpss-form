import { AcElement, IAcOnInit } from 'ac-runtime';

/**
 * Main application component decorated with @AcElement conforming strictly to ac-runtime.
 */
@AcElement({
  selector: 'abkkpss-app',
  template: `
    <div id="abkkpss-root"></div>
  `,
  styles: [
    `:host { display: block; min-height: 100vh; }`,
  ],
})
export class AbkkpssAppComponent implements IAcOnInit {
  acOnInit(): void {
    console.log('[ABKKPSS] App component initialized with ac-runtime');
  }
}
