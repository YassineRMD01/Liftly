import { Component, computed, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Rating } from 'primeng/rating';

/** Read-only star rating with average + count. */
@Component({
  selector: 'app-stars',
  imports: [Rating, FormsModule],
  templateUrl: './stars.html',
  styleUrl: './stars.css',
})
export class Stars {
  readonly value = input(0);
  readonly count = input<number>();
  protected readonly rounded = computed(() => Math.round(this.value()));
}
