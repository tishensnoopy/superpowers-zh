import type { Schema, Struct } from '@strapi/strapi';

export interface CommonAdvantage extends Struct.ComponentSchema {
  collectionName: 'components_common_advantages';
  info: {
    description: 'An advantage item';
    displayName: 'Advantage';
    icon: 'Star';
    pluralName: 'advantages';
    singularName: 'advantage';
  };
  attributes: {
    bgColor: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 20;
      }> &
      Schema.Attribute.DefaultTo<'#FFF3E5'>;
    color: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 20;
      }> &
      Schema.Attribute.DefaultTo<'#F5851F'>;
    description: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 500;
      }>;
    icon: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
  };
}

export interface CommonFeature extends Struct.ComponentSchema {
  collectionName: 'components_common_features';
  info: {
    description: 'A feature item';
    displayName: 'Feature';
    icon: 'Zap';
    pluralName: 'features';
    singularName: 'feature';
  };
  attributes: {
    description: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 500;
      }>;
    icon: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
  };
}

export interface CommonFormField extends Struct.ComponentSchema {
  collectionName: 'components_common_form_fields';
  info: {
    description: 'Contact form field';
    displayName: 'Form Field';
    icon: 'FileText';
    pluralName: 'form-fields';
    singularName: 'form-field';
  };
  attributes: {
    label: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    options: Schema.Attribute.JSON;
    placeholder: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    required: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    type: Schema.Attribute.Enumeration<
      ['text', 'email', 'phone', 'textarea', 'select']
    > &
      Schema.Attribute.Required;
  };
}

export interface CommonGalleryItem extends Struct.ComponentSchema {
  collectionName: 'components_common_gallery_items';
  info: {
    description: 'Gallery image item';
    displayName: 'Gallery Item';
    icon: 'Image';
    pluralName: 'gallery-items';
    singularName: 'gallery-item';
  };
  attributes: {
    description: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 500;
      }>;
    image: Schema.Attribute.Media & Schema.Attribute.Required;
    title: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
  };
}

export interface CommonQuickLink extends Struct.ComponentSchema {
  collectionName: 'components_common_quick_links';
  info: {
    description: 'Quick navigation link';
    displayName: 'Quick Link';
    icon: 'Link';
    pluralName: 'quick-links';
    singularName: 'quick-link';
  };
  attributes: {
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    url: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 500;
      }>;
  };
}

export interface CommonSeo extends Struct.ComponentSchema {
  collectionName: 'components_common_seos';
  info: {
    description: 'SEO meta tags and structured data';
    displayName: 'SEO';
    icon: 'Search';
    pluralName: 'seos';
    singularName: 'seo';
  };
  attributes: {
    canonicalUrl: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 500;
      }>;
    metaDescription: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 160;
      }>;
    metaKeywords: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    metaTitle: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 60;
      }>;
    ogDescription: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 160;
      }>;
    ogImage: Schema.Attribute.Media;
    ogTitle: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 60;
      }>;
    ogType: Schema.Attribute.Enumeration<['website', 'article', 'product']> &
      Schema.Attribute.DefaultTo<'website'>;
  };
}

export interface CommonSocialLink extends Struct.ComponentSchema {
  collectionName: 'components_common_social_links';
  info: {
    description: 'Social media link item';
    displayName: 'Social Link';
    icon: 'Link';
    pluralName: 'social-links';
    singularName: 'social-link';
  };
  attributes: {
    label: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    platform: Schema.Attribute.Enumeration<
      [
        'wechat',
        'weibo',
        'qq',
        'douyin',
        'linkedin',
        'twitter',
        'facebook',
        'instagram',
        'youtube',
      ]
    > &
      Schema.Attribute.Required;
    url: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 500;
      }>;
  };
}

export interface CommonTeamMember extends Struct.ComponentSchema {
  collectionName: 'components_common_team_members';
  info: {
    description: 'Team member profile';
    displayName: 'Team Member';
    icon: 'User';
    pluralName: 'team-members';
    singularName: 'team-member';
  };
  attributes: {
    avatar: Schema.Attribute.Media;
    bio: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 500;
      }>;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    position: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
  };
}

export interface CommonTestimonial extends Struct.ComponentSchema {
  collectionName: 'components_common_testimonials';
  info: {
    description: 'Customer testimonial';
    displayName: 'Testimonial';
    icon: 'MessageSquare';
    pluralName: 'testimonials';
    singularName: 'testimonial';
  };
  attributes: {
    author: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    avatar: Schema.Attribute.Media;
    company: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    content: Schema.Attribute.Text & Schema.Attribute.Required;
    position: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
  };
}

export interface CourseModule extends Struct.ComponentSchema {
  collectionName: 'components_course_modules';
  info: {
    description: '\u8BFE\u7A0B\u5927\u7EB2\u5206\u9636\u6BB5\u6A21\u5757';
    displayName: '\u8BFE\u7A0B\u6A21\u5757';
    icon: 'BookOpen';
    pluralName: 'modules';
    singularName: 'module';
  };
  attributes: {
    description: Schema.Attribute.Text;
    lessonCount: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
  };
}

export interface CourseObjective extends Struct.ComponentSchema {
  collectionName: 'components_course_objectives';
  info: {
    description: '\u8BFE\u7A0B\u5B66\u4E60\u76EE\u6807\u9879';
    displayName: '\u5B66\u4E60\u76EE\u6807';
    icon: 'Target';
    pluralName: 'objectives';
    singularName: 'objective';
  };
  attributes: {
    description: Schema.Attribute.Text;
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
  };
}

export interface CourseTestimonial extends Struct.ComponentSchema {
  collectionName: 'components_course_testimonials';
  info: {
    description: '\u5BB6\u957F\u5BF9\u8BFE\u7A0B\u7684\u8BC4\u4EF7';
    displayName: '\u8BFE\u7A0B\u8BC4\u4EF7';
    icon: 'MessageSquare';
    pluralName: 'course-testimonials';
    singularName: 'course-testimonial';
  };
  attributes: {
    content: Schema.Attribute.Text & Schema.Attribute.Required;
    parentName: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 50;
      }>;
    rating: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<5>;
  };
}

export interface SectionAdvantages extends Struct.ComponentSchema {
  collectionName: 'components_section_advantages';
  info: {
    description: 'Display company advantages';
    displayName: 'Advantages';
    icon: 'Trophy';
    pluralName: 'advantages';
    singularName: 'advantages';
  };
  attributes: {
    advantages: Schema.Attribute.Component<'common.advantage', true>;
    description: Schema.Attribute.Text;
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
  };
}

export interface SectionContactForm extends Struct.ComponentSchema {
  collectionName: 'components_section_contact_forms';
  info: {
    description: 'Contact form section';
    displayName: 'Contact Form';
    icon: 'Mail';
    pluralName: 'contact-forms';
    singularName: 'contact-form';
  };
  attributes: {
    description: Schema.Attribute.Text;
    fields: Schema.Attribute.Component<'common.form-field', true>;
    submitText: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 50;
      }> &
      Schema.Attribute.DefaultTo<'\u63D0\u4EA4'>;
    successMessage: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
  };
}

export interface SectionFaq extends Struct.ComponentSchema {
  collectionName: 'components_section_faqs';
  info: {
    description: 'Frequently asked questions';
    displayName: 'FAQ';
    icon: 'HelpCircle';
    pluralName: 'faqs';
    singularName: 'faq';
  };
  attributes: {
    faqs: Schema.Attribute.Relation<'manyToMany', 'api::faq-item.faq-item'>;
    showSearch: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
  };
}

export interface SectionFeatures extends Struct.ComponentSchema {
  collectionName: 'components_section_features';
  info: {
    description: 'Display product/service features';
    displayName: 'Features';
    icon: 'Layers';
    pluralName: 'features';
    singularName: 'features';
  };
  attributes: {
    description: Schema.Attribute.Text;
    features: Schema.Attribute.Component<'common.feature', true>;
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
  };
}

export interface SectionFloatingButton extends Struct.ComponentSchema {
  collectionName: 'components_section_floating_buttons';
  info: {
    description: 'Floating action button for consultation';
    displayName: 'Floating Button';
    icon: 'Phone';
    pluralName: 'floating-buttons';
    singularName: 'floating-button';
  };
  attributes: {
    action: Schema.Attribute.Enumeration<
      ['contact', 'chat', 'phone', 'callback']
    > &
      Schema.Attribute.DefaultTo<'contact'>;
    icon: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    label: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 50;
      }>;
    phone: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 50;
      }>;
    position: Schema.Attribute.Enumeration<['bottom-right', 'bottom-left']> &
      Schema.Attribute.DefaultTo<'bottom-right'>;
    wechat: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
  };
}

export interface SectionGallery extends Struct.ComponentSchema {
  collectionName: 'components_section_galleries';
  info: {
    description: 'Image gallery section';
    displayName: 'Gallery';
    icon: 'Images';
    pluralName: 'galleries';
    singularName: 'gallery';
  };
  attributes: {
    columns: Schema.Attribute.Enumeration<['2', '3', '4']> &
      Schema.Attribute.DefaultTo<'3'>;
    description: Schema.Attribute.Text;
    images: Schema.Attribute.Component<'common.gallery-item', true>;
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
  };
}

export interface SectionHero extends Struct.ComponentSchema {
  collectionName: 'components_section_heroes';
  info: {
    description: 'Hero section for homepage';
    displayName: 'Hero';
    icon: 'Layout';
    pluralName: 'heroes';
    singularName: 'hero';
  };
  attributes: {
    backgroundImage: Schema.Attribute.Media;
    buttonText: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 50;
      }>;
    buttonUrl: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 500;
      }>;
    description: Schema.Attribute.Text;
    isFullWidth: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    overlayColor: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 20;
      }>;
    subtitle: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 300;
      }>;
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
  };
}

export interface SectionProductComparison extends Struct.ComponentSchema {
  collectionName: 'components_section_product_comparisons';
  info: {
    description: 'Compare multiple products side by side';
    displayName: 'Product Comparison';
    icon: 'GitCompare';
    pluralName: 'product-comparisons';
    singularName: 'product-comparison';
  };
  attributes: {
    products: Schema.Attribute.Relation<'manyToMany', 'api::product.product'>;
    specs: Schema.Attribute.Relation<
      'manyToMany',
      'api::product-spec.product-spec'
    >;
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
  };
}

export interface SectionProductGrid extends Struct.ComponentSchema {
  collectionName: 'components_section_product_grids';
  info: {
    description: 'Display products in grid layout';
    displayName: 'Product Grid';
    icon: 'Grid';
    pluralName: 'product-grids';
    singularName: 'product-grid';
  };
  attributes: {
    categoryFilter: Schema.Attribute.Relation<
      'manyToMany',
      'api::product-category.product-category'
    >;
    columns: Schema.Attribute.Enumeration<['2', '3', '4']> &
      Schema.Attribute.DefaultTo<'3'>;
    description: Schema.Attribute.Text;
    products: Schema.Attribute.Relation<'manyToMany', 'api::product.product'>;
    showFilter: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
  };
}

export interface SectionRichText extends Struct.ComponentSchema {
  collectionName: 'components_section_rich_texts';
  info: {
    description: 'Rich text content section';
    displayName: 'Rich Text';
    icon: 'AlignLeft';
    pluralName: 'rich-texts';
    singularName: 'rich-text';
  };
  attributes: {
    alignment: Schema.Attribute.Enumeration<['left', 'center', 'right']> &
      Schema.Attribute.DefaultTo<'left'>;
    content: Schema.Attribute.Text & Schema.Attribute.Required;
    title: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
  };
}

export interface SectionTeam extends Struct.ComponentSchema {
  collectionName: 'components_section_teams';
  info: {
    description: 'Display team members';
    displayName: 'Team';
    icon: 'Users';
    pluralName: 'teams';
    singularName: 'team';
  };
  attributes: {
    description: Schema.Attribute.Text;
    members: Schema.Attribute.Component<'common.team-member', true>;
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
  };
}

export interface SectionTestimonials extends Struct.ComponentSchema {
  collectionName: 'components_section_testimonials';
  info: {
    description: 'Display customer testimonials';
    displayName: 'Testimonials';
    icon: 'Quote';
    pluralName: 'testimonials';
    singularName: 'testimonials';
  };
  attributes: {
    testimonials: Schema.Attribute.Component<'common.testimonial', true>;
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
  };
}

declare module '@strapi/strapi' {
  export namespace Public {
    export interface ComponentSchemas {
      'common.advantage': CommonAdvantage;
      'common.feature': CommonFeature;
      'common.form-field': CommonFormField;
      'common.gallery-item': CommonGalleryItem;
      'common.quick-link': CommonQuickLink;
      'common.seo': CommonSeo;
      'common.social-link': CommonSocialLink;
      'common.team-member': CommonTeamMember;
      'common.testimonial': CommonTestimonial;
      'course.module': CourseModule;
      'course.objective': CourseObjective;
      'course.testimonial': CourseTestimonial;
      'section.advantages': SectionAdvantages;
      'section.contact-form': SectionContactForm;
      'section.faq': SectionFaq;
      'section.features': SectionFeatures;
      'section.floating-button': SectionFloatingButton;
      'section.gallery': SectionGallery;
      'section.hero': SectionHero;
      'section.product-comparison': SectionProductComparison;
      'section.product-grid': SectionProductGrid;
      'section.rich-text': SectionRichText;
      'section.team': SectionTeam;
      'section.testimonials': SectionTestimonials;
    }
  }
}
