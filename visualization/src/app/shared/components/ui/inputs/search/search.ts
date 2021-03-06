import {
  Component, ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import {Subject} from 'rxjs/internal/Subject';
import {Subscription} from 'rxjs/internal/Subscription';
import {debounceTime, distinctUntilChanged, map, startWith, switchMap} from 'rxjs/operators';
import {Observable} from 'rxjs';

@Component({
  selector: 'app-search-input',
  templateUrl: './search.html',
  styleUrls: ['./search.scss']
})
export class SearchInputComponent implements OnInit, OnChanges, OnDestroy {
  private searchTerms = new Subject<string>();
  private searchTermsSubscription: Subscription;
  private _isActive = false;

  public filteredOptions: Observable<string[]>;

  @Input()
  public query: string;

  @Input()
  placeholder: string;

  @Input()
  public options: string[] = [];

  @Input()
  public id: string;

  @Output()
  valueChange: EventEmitter<string>;

  private static saveSearchTerm(id: string, searchTerm: string): void {
    if (!id) {
      return;
    }
    localStorage.setItem(`search-${id}`, searchTerm);
  }

  private static getSearchTerm(id: string): string {
    if (!id) {
      return;
    }
    return localStorage.getItem(`search-${id}`);
  }

  private static deleteSearchTerm(id): void {
    if (!id) {
      return;
    }
    localStorage.removeItem(`search-${id}`);
  }

  constructor() {
    this.valueChange = new EventEmitter<string>();
  }

  private _filter(value: string): string[] {
    if (!value) {
      return this.options;
    }
    const filterValue = value.toLowerCase();

    return this.options.filter(option => option.toLowerCase().includes(filterValue));
  }

  public searchOnInput(query: string) {
    this.query = query;
    this.searchTerms.next(query);
  }

  public reset() {
    this.query = '';
    this.searchTerms.next(null);
  }

  public setActive(isActive: boolean) {
    this._isActive = isActive;
  }

  public isActive() {
    return this._isActive;
  }

  ngOnInit(): void {
    this.filteredOptions = this.valueChange
      .pipe(
        startWith(''),
        map(value => this._filter(value))
      );

    this.searchTermsSubscription =
      this.searchTerms
        .pipe(
          debounceTime(100),        // wait for 300ms pause in events
          distinctUntilChanged(),   // ignore if next search term is same as previous
          map(term => {
              if (term && term.length > 0) {
                this.valueChange.emit(term);
                SearchInputComponent.saveSearchTerm(this.id, term);
              } else {
                this.valueChange.emit(null);
                SearchInputComponent.deleteSearchTerm(this.id);
              }
              return term || '';
            }
          )
        )
        .subscribe();

    const existingSearchTerm = SearchInputComponent.getSearchTerm(this.id);
    if (existingSearchTerm) {
      this.searchOnInput(existingSearchTerm);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.query && changes.query.currentValue) {
      this.searchOnInput(changes.query.currentValue);
    }
  }

  ngOnDestroy(): void {
    this.searchTermsSubscription.unsubscribe();
  }
}
