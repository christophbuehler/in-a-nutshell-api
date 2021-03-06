import { RequestOptions, Headers } from '@angular/http';
import { Component, Injectable, ViewChild, ElementRef, ChangeDetectorRef, OnInit } from '@angular/core';
import { TopicService, Topic } from './topic.service';
import { ReplaySubject, BehaviorSubject,  of as observableOf,  merge as observableMerge,  Observable,  Subject, fromEvent } from 'rxjs';
import { NestedTreeControl } from '@angular/cdk/tree';
import { MatTreeNestedDataSource } from '@angular/material';
import { TopicDatabase, OrderedTopic } from './topic-database';
import 'rxjs/add/operator/mergeMap';
import { map, combineLatest, share, tap, filter, take, switchMap, distinctUntilChanged } from 'rxjs/internal/operators';
import { FormControl, FormGroup } from '@angular/forms';
import { Portal } from '@angular/cdk/portal';
import { element } from 'protractor';
import { ImagePreviewComponent } from './image-preview/image-preview.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  @ViewChild('markdownUi', { read: ElementRef }) markdownUi: ElementRef;
  previewImage: Observable<HTMLElement>;
  nestedTreeControl: NestedTreeControl<OrderedTopic>;
  nestedDataSource: MatTreeNestedDataSource<OrderedTopic>;
  topic: Observable<Topic>;
  topicId = new ReplaySubject<number>(1);
  group = new FormGroup({
    path: new FormControl(),
    title: new FormControl(),
    body: new FormControl(),
  });
  mode = 'view';

  constructor(
    private topicService: TopicService,
    database: TopicDatabase,
    cdRef: ChangeDetectorRef,
  ) {
    this.nestedTreeControl = new NestedTreeControl<OrderedTopic>(this.getChildren);
    this.nestedDataSource = new MatTreeNestedDataSource();
    this.topic = topicService.topics.pipe(
      combineLatest(this.topicId.pipe(
        distinctUntilChanged(),
      )),
      map<any, Topic>(([topics, id]) => (<Topic[]>topics).find(t => t.id === id)),
    );

    this.topic.pipe(
      tap(t => {
        if (!t) {
          return;
        }
        const controls = this.group.controls;
        controls.path.setValue(t.path);
        controls.title.setValue(t.title);
        controls.body.setValue(t.body);
        this.group.markAsPristine();
      }),
    ).subscribe();

    database.dataChange
      .subscribe(data => this.nestedDataSource.data = data);
  }

  ngOnInit(): void {
    this.previewImage = fromEvent(this.markdownUi.nativeElement, 'click').pipe(
      map((ev: MouseEvent) => (<HTMLElement>ev.target)),
      filter((el: HTMLElement) => el.tagName === 'IMG'),
    );
  }

  selectTopic(id: number) {
   this.topicId.next(id);
  }

  createTopic(parent: OrderedTopic = void 0) {
    const topic = {
      id: -1,
      path: parent ? parent.path.replace(/^\/|\/$/g, '') + '/' + parent.title.toLowerCase().replace(/ /g, '-') : '',
      body: '',
      title: 'New Topic',
    };
    this.topicService.addTopic(topic);
    this.selectTopic(topic.id);
  }

  saveTopic() {
    this.group.markAsPristine();
    const controls = this.group.controls;
    this.topicId.pipe(
      take(1),
      map(id => (<Topic>{
        id,
        body: controls.body.value,
        path: controls.path.value,
        title: controls.title.value,
      })),
      switchMap(topic => this.topicService.saveTopic(topic)),
      tap(id => this.selectTopic(id)),
    ).subscribe();
  }

  deleteTopic() {
    this.topicId.pipe(
      switchMap(id => this.topicService.deleteTopic(id)),
      tap(() => this.selectTopic(void 0)),
    ).subscribe();
  }

  hasNestedChild = (_: number, nodeData: OrderedTopic) => nodeData.children.length > 0;

  private getChildren = (node: OrderedTopic) => observableOf(node.children);
}
